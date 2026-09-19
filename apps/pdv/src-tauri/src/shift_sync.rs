use crate::adapters::nuvem::api_sync::ApiSync;
use crate::application::ports::RepoErro;
use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};
use serde_json::json;

struct Pending {
    uid: String,
    operator_uid: String,
    initial: i64,
    opened: String,
    updated: String,
    status: String,
    closed: Option<String>,
    expected: Option<i64>,
    checked: Option<i64>,
    difference: Option<i64>,
}

fn db_error(error: DbErr) -> RepoErro { RepoErro::Persistencia(error.to_string()) }
fn invalid() -> RepoErro { RepoErro::Persistencia("Turno local incompleto; sincronizacao preservada".into()) }

async fn pending(db: &DatabaseConnection, machine_uid: &str) -> Result<Vec<Pending>, RepoErro> {
    let rows = db.query_all(Statement::from_sql_and_values(db.get_database_backend(),
        "SELECT t.sync_uid, u.sync_uid AS operador_uid, t.caixa_inicial_centavos, t.abertura,
                t.atualizado_em, t.status, t.encerramento, t.esperado_centavos,
                t.conferido_centavos, t.diferenca_centavos
         FROM turno_operacao t LEFT JOIN usuario u ON lower(u.usuario)=lower(t.operador)
         WHERE t.pdv_uid=? AND t.sincronizado_em IS NULL AND t.excluido_em IS NULL
         ORDER BY t.abertura LIMIT 100", [machine_uid.into()])).await.map_err(db_error)?;
    rows.into_iter().map(|r| Ok(Pending {
        uid: r.try_get("", "sync_uid").map_err(db_error)?,
        operator_uid: r.try_get::<Option<String>>("", "operador_uid").map_err(db_error)?.ok_or_else(invalid)?,
        initial: r.try_get("", "caixa_inicial_centavos").map_err(db_error)?,
        opened: r.try_get("", "abertura").map_err(db_error)?,
        updated: r.try_get("", "atualizado_em").map_err(db_error)?,
        status: r.try_get("", "status").map_err(db_error)?,
        closed: r.try_get("", "encerramento").map_err(db_error)?,
        expected: r.try_get("", "esperado_centavos").map_err(db_error)?,
        checked: r.try_get("", "conferido_centavos").map_err(db_error)?,
        difference: r.try_get("", "diferenca_centavos").map_err(db_error)?,
    })).collect()
}

async fn acknowledge(db: &DatabaseConnection, shift: &Pending) -> Result<(), RepoErro> {
    db.execute(Statement::from_sql_and_values(db.get_database_backend(),
        "UPDATE turno_operacao SET sincronizado_em=datetime('now')
         WHERE sync_uid=? AND atualizado_em=? AND status=? AND sincronizado_em IS NULL",
        [shift.uid.clone().into(), shift.updated.clone().into(), shift.status.clone().into()]))
        .await.map_err(db_error)?;
    Ok(())
}

pub async fn send_open(db: &DatabaseConnection, api: &ApiSync, machine_uid: &str) -> Result<usize, RepoErro> {
    let mut sent = 0;
    for shift in pending(db, machine_uid).await? {
        let receipt = api.enviar_turno(&shift.uid, false, &json!({
            "turnoUid": shift.uid, "operadorUid": shift.operator_uid,
            "caixaInicialCentavos": shift.initial, "abertura": shift.opened,
        })).await?;
        if receipt.get("turnoUid").and_then(|v| v.as_str()) != Some(&shift.uid) ||
            receipt.get("recebido").and_then(|v| v.as_bool()) != Some(true) { return Err(invalid()); }
        if shift.status == "aberto" {
            acknowledge(db, &shift).await?;
        } else if shift.status == "encerrado" {
            close_one(db, api, &shift).await?;
        } else { return Err(invalid()); }
        sent += 1;
    }
    Ok(sent)
}

pub async fn send_closed(db: &DatabaseConnection, api: &ApiSync, machine_uid: &str) -> Result<usize, RepoErro> {
    let mut sent = 0;
    for shift in pending(db, machine_uid).await? {
        if shift.status != "encerrado" { continue; }
        close_one(db, api, &shift).await?;
        sent += 1;
    }
    Ok(sent)
}

async fn close_one(db: &DatabaseConnection, api: &ApiSync, shift: &Pending) -> Result<(), RepoErro> {
    let receipt = api.enviar_turno(&shift.uid, true, &json!({
        "encerramento": shift.closed.as_ref().ok_or_else(invalid)?,
        "esperadoCentavos": shift.expected.ok_or_else(invalid)?,
        "conferidoCentavos": shift.checked.ok_or_else(invalid)?,
        "diferencaCentavos": shift.difference.ok_or_else(invalid)?,
    })).await?;
    if receipt.get("turnoUid").and_then(|v| v.as_str()) != Some(&shift.uid) ||
        receipt.get("encerrado").and_then(|v| v.as_bool()) != Some(true) { return Err(invalid()); }
    acknowledge(db, shift).await
}
