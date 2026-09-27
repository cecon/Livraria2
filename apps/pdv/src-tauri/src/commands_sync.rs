//! Sincronizacao exclusiva com a API da nuvem.

use crate::commands::AppState;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumoSyncDto {
    pub enviados: usize,
    pub recebidos: usize,
    pub orfas: usize,
}

/// Dispara uma sincronização completa (push→pull→recompute). Também é chamado
/// pelo agendador em background (T041). A venda nunca bloqueia por isto.
#[tauri::command]
pub async fn sincronizar_agora(state: tauri::State<'_, AppState>) -> Result<ResumoSyncDto, String> {
    let r = crate::sync_dispatch::executar(
        &state.db,
        state.machine_config_path.as_deref(),
    )
        .await.map_err(|e| e.to_string())?;
    Ok(ResumoSyncDto { enviados: r.enviados, recebidos: r.recebidos, orfas: r.orfas })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperadorDto {
    pub usuario: String,
    pub nome: Option<String>,
}

/// Lista os operadores (usuários do PDV) para o caixa escolher quem está operando
/// (FR-023). Não expõe senha.
#[tauri::command]
pub async fn listar_operadores(state: tauri::State<'_, AppState>) -> Result<Vec<OperadorDto>, String> {
    let rows = state
        .db
        .query_all(Statement::from_string(
            state.db.get_database_backend(),
            "SELECT usuario, nome FROM usuario WHERE (excluido_em IS NULL OR excluido_em='') ORDER BY usuario"
                .to_string(),
        ))
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows
        .iter()
        .map(|r| OperadorDto {
            usuario: r.try_get::<String>("", "usuario").unwrap_or_default(),
            nome: r.try_get::<Option<String>>("", "nome").ok().flatten(),
        })
        .collect())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusSyncDto {
    pub imagens_pendentes: i64,
    /// Total de registros locais ainda não sincronizados (FR-014).
    pub pendentes: i64,
}

/// Estado de sincronização para o indicador da UI (não usa rede).
#[tauri::command]
pub async fn status_sincronizacao(state: tauri::State<'_, AppState>) -> Result<StatusSyncDto, String> {
    let row = state.db.query_one(Statement::from_string(state.db.get_database_backend(),
        "SELECT count(DISTINCT p.capa_uid) AS n FROM produto_capa p LEFT JOIN capa_cache c ON c.uid=p.capa_uid WHERE p.capa_uid IS NOT NULL AND c.uid IS NULL"))
        .await.map_err(|e| e.to_string())?;
    let imagens_pendentes = row.and_then(|r| r.try_get("", "n").ok()).unwrap_or(0);
    Ok(StatusSyncDto { pendentes: contar_pendentes(&state.db).await?, imagens_pendentes })
}

async fn contar_pendentes(db: &DatabaseConnection) -> Result<i64, String> {
    let backend = db.get_database_backend();
        // A API publica o catalogo e recebe vendas. Baselines locais de estoque nao
        // sao envios pendentes; a mesma venda pode estar no pedido e no outbox.
        let row = db.query_one(Statement::from_string(backend,
            "SELECT COUNT(DISTINCT uid) AS n FROM (
               SELECT COALESCE(sync_uid, 'pedido:' || numero) AS uid FROM pedido
               WHERE sincronizado_em IS NULL
               UNION ALL
               SELECT pedido_uid AS uid FROM nuvem_api_outbox WHERE enviada=0
               UNION ALL
               SELECT sync_uid AS uid FROM turno_operacao WHERE pdv_uid IS NOT NULL AND sincronizado_em IS NULL
               UNION ALL
               SELECT sync_uid AS uid FROM caixa_movimento WHERE sincronizado_em IS NULL
             )".to_string(),
        )).await.map_err(|e| e.to_string())?;
        return Ok(row.and_then(|r| r.try_get::<i64>("", "n").ok()).unwrap_or(0));

}
#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::Database;

    #[tokio::test]
    async fn modo_api_conta_vendas_sem_duplicar_outbox_e_ignora_baselines() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        for sql in [
            "CREATE TABLE pedido (numero INTEGER PRIMARY KEY, sync_uid TEXT, sincronizado_em TEXT)",
            "CREATE TABLE nuvem_api_outbox (pedido_uid TEXT, enviada INTEGER)",
            "CREATE TABLE turno_operacao (sync_uid TEXT, pdv_uid TEXT, sincronizado_em TEXT)",
            "CREATE TABLE caixa_movimento (sync_uid TEXT, sincronizado_em TEXT)",
            "CREATE TABLE movimento_estoque (tipo TEXT, sincronizado_em TEXT)",
            "INSERT INTO movimento_estoque VALUES ('saldo_inicial', NULL)",
            "INSERT INTO pedido VALUES (1, 'venda-1', NULL)",
            "INSERT INTO nuvem_api_outbox VALUES ('venda-1', 0)",
            "INSERT INTO pedido VALUES (2, 'venda-2', '2026-09-16')",
            "INSERT INTO nuvem_api_outbox VALUES ('venda-2', 0)",
            "INSERT INTO pedido VALUES (3, 'venda-3', '2026-09-16')",
            "INSERT INTO nuvem_api_outbox VALUES ('venda-3', 1)",
            "INSERT INTO turno_operacao VALUES ('turno-1', 'maquina-1', NULL)",
            "INSERT INTO caixa_movimento VALUES ('movimento-1', NULL)",
        ] {
            db.execute(Statement::from_string(db.get_database_backend(), sql.to_string()))
                .await.unwrap();
        }
        assert_eq!(contar_pendentes(&db).await.unwrap(), 4);
        db.execute(Statement::from_string(db.get_database_backend(),
            "UPDATE pedido SET sincronizado_em='2026-09-16' WHERE numero=1".to_string(),
        )).await.unwrap();
        db.execute(Statement::from_string(db.get_database_backend(),
            "UPDATE nuvem_api_outbox SET enviada=1".to_string(),
        )).await.unwrap();
        db.execute(Statement::from_string(db.get_database_backend(),
            "UPDATE turno_operacao SET sincronizado_em='2026-09-16'".to_string(),
        )).await.unwrap();
        db.execute(Statement::from_string(db.get_database_backend(),
            "UPDATE caixa_movimento SET sincronizado_em='2026-09-16'".to_string(),
        )).await.unwrap();
        assert_eq!(contar_pendentes(&db).await.unwrap(), 0);
    }
}
