use crate::adapters::nuvem::api_sync::ApiSync;
use crate::application::ports::RepoErro;
use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};
use serde_json::json;

fn db_error(error: DbErr) -> RepoErro { RepoErro::Persistencia(error.to_string()) }

pub async fn send(db: &DatabaseConnection, api: &ApiSync, machine_uid: &str) -> Result<usize, RepoErro> {
    let rows = db.query_all(Statement::from_sql_and_values(db.get_database_backend(),
        "SELECT m.sync_uid, m.turno_uid, u.sync_uid AS operador_uid,
                m.tipo, m.valor_centavos, m.motivo, m.criado_em
         FROM caixa_movimento m JOIN turno_operacao t ON t.sync_uid=m.turno_uid
         LEFT JOIN usuario u ON lower(u.usuario)=lower(m.operador)
         WHERE t.pdv_uid=? AND m.sincronizado_em IS NULL
         ORDER BY m.criado_em LIMIT 500", [machine_uid.into()])).await.map_err(db_error)?;
    let mut sent = 0;
    for row in rows {
        let uid: String = row.try_get("", "sync_uid").map_err(db_error)?;
        let operator: Option<String> = row.try_get("", "operador_uid").map_err(db_error)?;
        let operator = operator.ok_or_else(|| RepoErro::Persistencia("Usuario do movimento nao sincronizado".into()))?;
        let receipt = api.enviar_movimento(&json!({
            "movimentoUid": uid,
            "turnoUid": row.try_get::<String>("", "turno_uid").map_err(db_error)?,
            "operadorUid": operator,
            "tipo": row.try_get::<String>("", "tipo").map_err(db_error)?,
            "valorCentavos": row.try_get::<i64>("", "valor_centavos").map_err(db_error)?,
            "motivo": row.try_get::<String>("", "motivo").map_err(db_error)?,
            "criadoEm": row.try_get::<String>("", "criado_em").map_err(db_error)?,
        })).await?;
        if receipt.get("movimentoUid").and_then(|v| v.as_str()) != Some(&uid) ||
            receipt.get("recebido").and_then(|v| v.as_bool()) != Some(true) {
            return Err(RepoErro::Persistencia("Recibo de movimento invalido".into()));
        }
        db.execute(Statement::from_sql_and_values(db.get_database_backend(),
            "UPDATE caixa_movimento SET sincronizado_em=datetime('now') WHERE sync_uid=? AND sincronizado_em IS NULL",
            [uid.into()])).await.map_err(db_error)?;
        sent += 1;
    }
    Ok(sent)
}
