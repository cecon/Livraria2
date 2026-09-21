//! Comandos Tauri da sincronização (feature 007). Ligam o adapter da nuvem
//! (`SupabaseSync`) + a réplica local (`SeaReplicaSync`) + a orquestração.
//! Segredos (URL/ANON/EMAIL/SENHA do PDV) vêm do ambiente (ADR-0015).

use crate::adapters::nuvem::supabase_sync::SupabaseSync;
use crate::adapters::persistencia::replica_sync::SeaReplicaSync;
use crate::application::sincronizacao::semear;
use crate::commands::AppState;
use crate::domain::sincronizacao::ORDEM_DEPENDENCIA;
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
        state.config_sync_path.as_deref(),
        state.machine_config_path.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(ResumoSyncDto {
        enviados: r.enviados,
        recebidos: r.recebidos,
        orfas: r.orfas,
    })
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
pub async fn listar_operadores(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<OperadorDto>, String> {
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

/// Carga inicial: sobe todo o histórico pendente para a nuvem (T028). Retorna
/// quantos registros foram enviados.
#[tauri::command]
pub async fn seed_inicial(state: tauri::State<'_, AppState>) -> Result<usize, String> {
    if crate::machine_config::is_configured(state.machine_config_path.as_deref()) {
        return Err("Seed legado bloqueado no modo API".into());
    }
    let nuvem = SupabaseSync::conectar(state.config_sync_path.as_deref())
        .await
        .map_err(|e| e.to_string())?;
    let local = SeaReplicaSync::new(state.db.clone());
    semear(&nuvem, &local).await.map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusSyncDto {
    /// Total de registros locais ainda não sincronizados (FR-014).
    pub pendentes: i64,
}

/// Estado de sincronização para o indicador da UI (não usa rede).
#[tauri::command]
pub async fn status_sincronizacao(
    state: tauri::State<'_, AppState>,
) -> Result<StatusSyncDto, String> {
    let api_mode = crate::machine_config::is_configured(state.machine_config_path.as_deref());
    Ok(StatusSyncDto {
        pendentes: contar_pendentes(&state.db, api_mode).await?,
    })
}

async fn contar_pendentes(db: &DatabaseConnection, api_mode: bool) -> Result<i64, String> {
    let backend = db.get_database_backend();
    if api_mode {
        // A API publica o catalogo e recebe vendas. Baselines locais de estoque nao
        // sao envios pendentes; a mesma venda pode estar no pedido e no outbox.
        let mut fontes = vec![
            "SELECT COALESCE(sync_uid, 'pedido:' || numero) AS uid FROM pedido WHERE sincronizado_em IS NULL".to_string(),
            "SELECT pedido_uid AS uid FROM nuvem_api_outbox WHERE enviada=0".to_string(),
        ];
        if tabela_existe(db, "turno_operacao").await? {
            fontes.push(
                "SELECT sync_uid AS uid FROM turno_operacao WHERE sincronizado_em IS NULL"
                    .to_string(),
            );
        }
        if tabela_existe(db, "caixa_movimento").await? {
            fontes.push(
                "SELECT sync_uid AS uid FROM caixa_movimento WHERE sincronizado_em IS NULL"
                    .to_string(),
            );
        }
        let sql = format!(
            "SELECT COUNT(DISTINCT uid) AS n FROM ({})",
            fontes.join(" UNION ALL ")
        );
        let row = db
            .query_one(Statement::from_string(backend, sql))
            .await
            .map_err(|e| e.to_string())?;
        return Ok(row
            .and_then(|r| r.try_get::<i64>("", "n").ok())
            .unwrap_or(0));
    }
    let mut pendentes = 0i64;
    for recurso in ORDEM_DEPENDENCIA {
        let filtro = if *recurso == "movimento_estoque" {
            "sincronizado_em IS NULL AND tipo NOT IN ('saida_venda','estorno')"
        } else {
            "sincronizado_em IS NULL"
        };
        let rows = db
            .query_all(Statement::from_string(
                backend,
                format!("SELECT COUNT(*) AS n FROM {recurso} WHERE {filtro}"),
            ))
            .await
            .map_err(|e| e.to_string())?;
        pendentes += rows
            .first()
            .and_then(|r| r.try_get::<i64>("", "n").ok())
            .unwrap_or(0);
    }
    Ok(pendentes)
}

async fn tabela_existe(db: &DatabaseConnection, tabela: &str) -> Result<bool, String> {
    let row = db
        .query_one(Statement::from_sql_and_values(
            db.get_database_backend(),
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
            [tabela.into()],
        ))
        .await
        .map_err(|e| e.to_string())?;
    Ok(row.is_some())
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
            "CREATE TABLE movimento_estoque (tipo TEXT, sincronizado_em TEXT)",
            "INSERT INTO movimento_estoque VALUES ('saldo_inicial', NULL)",
            "INSERT INTO pedido VALUES (1, 'venda-1', NULL)",
            "INSERT INTO nuvem_api_outbox VALUES ('venda-1', 0)",
            "INSERT INTO pedido VALUES (2, 'venda-2', '2026-09-16')",
            "INSERT INTO nuvem_api_outbox VALUES ('venda-2', 0)",
            "INSERT INTO pedido VALUES (3, 'venda-3', '2026-09-16')",
            "INSERT INTO nuvem_api_outbox VALUES ('venda-3', 1)",
        ] {
            db.execute(Statement::from_string(
                db.get_database_backend(),
                sql.to_string(),
            ))
            .await
            .unwrap();
        }
        assert_eq!(contar_pendentes(&db, true).await.unwrap(), 2);
        db.execute(Statement::from_string(
            db.get_database_backend(),
            "UPDATE pedido SET sincronizado_em='2026-09-16' WHERE numero=1".to_string(),
        ))
        .await
        .unwrap();
        db.execute(Statement::from_string(
            db.get_database_backend(),
            "UPDATE nuvem_api_outbox SET enviada=1".to_string(),
        ))
        .await
        .unwrap();
        assert_eq!(contar_pendentes(&db, true).await.unwrap(), 0);
    }
}
