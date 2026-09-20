use crate::adapters::nuvem::api_sync::ApiSync;
use crate::commands::{AppState, ErroDto};
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};
use serde_json::{json, Value};

fn erro(error: impl std::fmt::Display) -> ErroDto {
    ErroDto { codigo: "LLM_INDISPONIVEL".into(), mensagem: error.to_string() }
}

async fn turno_local(db: &DatabaseConnection, machine_uid: &str) -> Result<(String, Value), ErroDto> {
    let rows = db.query_all(Statement::from_sql_and_values(db.get_database_backend(),
        "SELECT t.sync_uid, u.sync_uid AS usuario_uid, t.abertura, t.caixa_inicial_centavos
         FROM turno_operacao t JOIN usuario u ON lower(u.usuario)=lower(t.operador)
         WHERE t.pdv_uid=? AND t.status='aberto' AND t.encerramento IS NULL
           AND t.excluido_em IS NULL AND (u.excluido_em IS NULL OR u.excluido_em='')",
        [machine_uid.into()])).await.map_err(erro)?;
    if rows.len() != 1 {
        return Err(erro("Abra um único turno nesta máquina para testar as LLMs."));
    }
    let row = &rows[0];
    let turno: String = row.try_get("", "sync_uid").map_err(erro)?;
    let usuario: String = row.try_get("", "usuario_uid").map_err(erro)?;
    let payload = json!({
        "turnoUid": turno, "operadorUid": usuario,
        "abertura": row.try_get::<String>("", "abertura").map_err(erro)?,
        "caixaInicialCentavos": row.try_get::<i64>("", "caixa_inicial_centavos").map_err(erro)?,
    });
    Ok((turno, payload))
}

async fn contexto(state: &AppState) -> Result<(ApiSync, String), ErroDto> {
    let machine = crate::machine_config::identity(state.machine_config_path.as_deref()).map_err(erro)?;
    let (turno, payload) = turno_local(&state.db, &machine.pdv_uid).await?;
    let api = ApiSync::conectar_com_config(state.machine_config_path.as_deref()).await.map_err(erro)?;
    let receipt = api.enviar_turno(&turno, false, &payload).await.map_err(erro)?;
    if receipt.get("turnoUid").and_then(Value::as_str) != Some(turno.as_str()) ||
        receipt.get("recebido").and_then(Value::as_bool) != Some(true) {
        return Err(erro("A retaguarda não confirmou o turno desta máquina."));
    }
    Ok((api, turno))
}

#[tauri::command]
pub async fn llms_listar(state: tauri::State<'_, AppState>) -> Result<Value, ErroDto> {
    let (api, turno) = contexto(&state).await?;
    api.llms(&turno, None).await.map_err(erro)
}

#[tauri::command]
pub async fn llm_testar(state: tauri::State<'_, AppState>, uid: String) -> Result<Value, ErroDto> {
    uuid::Uuid::parse_str(&uid).map_err(|_| erro("Configuração inválida"))?;
    let (api, turno) = contexto(&state).await?;
    api.llms(&turno, Some(&uid)).await.map_err(erro)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::Database;

    #[tokio::test]
    async fn resolve_somente_turno_unico_aberto_da_maquina() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        for sql in [
            "CREATE TABLE usuario(usuario TEXT,sync_uid TEXT,excluido_em TEXT)",
            "CREATE TABLE turno_operacao(sync_uid TEXT,operador TEXT,pdv_uid TEXT,status TEXT,encerramento TEXT,excluido_em TEXT,abertura TEXT,caixa_inicial_centavos INTEGER)",
            "INSERT INTO usuario VALUES('operador','usuario-uid',NULL)",
            "INSERT INTO turno_operacao VALUES('turno-uid','OPERADOR','maquina','aberto',NULL,NULL,'2026-09-19T12:00:00',100)",
        ] {
            db.execute(Statement::from_string(db.get_database_backend(), sql.to_string())).await.unwrap();
        }
        let (uid, payload) = turno_local(&db, "maquina").await.unwrap();
        assert_eq!(uid, "turno-uid");
        assert_eq!(payload["operadorUid"], "usuario-uid");
        assert!(turno_local(&db, "outra-maquina").await.is_err());
        db.execute(Statement::from_string(db.get_database_backend(),
            "INSERT INTO turno_operacao SELECT * FROM turno_operacao".to_string())).await.unwrap();
        assert!(turno_local(&db, "maquina").await.is_err());
        db.execute(Statement::from_string(db.get_database_backend(),
            "UPDATE turno_operacao SET status='encerrado'".to_string())).await.unwrap();
        assert!(turno_local(&db, "maquina").await.is_err());
    }
}
