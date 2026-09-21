use super::api_replica::erro;
use crate::application::api_sync::{EnvioApi, OperacaoApi};
use crate::application::ports::RepoErro;
use sea_orm::{ConnectionTrait, Statement};
use serde_json::{json, Value};

pub async fn preparar_operacionais<C: ConnectionTrait>(db: &C) -> Result<(), RepoErro> {
    let backend = db.get_database_backend();
    let turnos = db.query_all(Statement::from_string(backend,
        "SELECT t.sync_uid AS uid,u.sync_uid AS operador_uid,t.caixa_inicial_centavos,t.status,
          t.abertura,t.encerramento,t.esperado_centavos,t.conferido_centavos,t.diferenca_centavos
         FROM turno_operacao t JOIN usuario u ON lower(u.usuario)=lower(t.operador)
         WHERE t.sincronizado_em IS NULL AND t.excluido_em IS NULL
         ORDER BY t.abertura LIMIT 500".to_string())).await.map_err(erro)?;
    for row in turnos {
        let uid: String = row.try_get("", "uid").map_err(erro)?;
        let abertura = json!({
            "turnoUid":uid,
            "operadorUid":row.try_get::<String>("","operador_uid").map_err(erro)?,
            "caixaInicialCentavos":row.try_get::<i64>("","caixa_inicial_centavos").map_err(erro)?,
            "abertura":row.try_get::<String>("","abertura").map_err(erro)?
        });
        inserir(db, &format!("{uid}:turno_abertura"), &uid, false, &abertura).await?;
        if row.try_get::<String>("", "status").map_err(erro)? == "encerrado" {
            let fechamento = json!({
                "esperadoCentavos":row.try_get::<i64>("","esperado_centavos").map_err(erro)?,
                "conferidoCentavos":row.try_get::<i64>("","conferido_centavos").map_err(erro)?,
                "diferencaCentavos":row.try_get::<i64>("","diferenca_centavos").map_err(erro)?,
                "encerramento":row.try_get::<String>("","encerramento").map_err(erro)?
            });
            inserir(db, &format!("{uid}:turno_fechamento"), &uid, false, &fechamento).await?;
        }
    }
    if tabela_existe(db, "caixa_movimento").await? { preparar_caixa(db).await?; }
    Ok(())
}

async fn preparar_caixa<C: ConnectionTrait>(db: &C) -> Result<(), RepoErro> {
    let rows = db.query_all(Statement::from_string(db.get_database_backend(),
        "SELECT m.sync_uid AS uid,m.turno_uid,u.sync_uid AS operador_uid,m.tipo,
          m.valor_centavos,m.motivo,m.criado_em
         FROM caixa_movimento m JOIN usuario u ON lower(u.usuario)=lower(m.operador)
         WHERE m.sincronizado_em IS NULL ORDER BY m.criado_em LIMIT 500".to_string()))
        .await.map_err(erro)?;
    for row in rows {
        let uid: String = row.try_get("", "uid").map_err(erro)?;
        let body = json!({
            "movimentoUid":uid,
            "turnoUid":row.try_get::<String>("","turno_uid").map_err(erro)?,
            "operadorUid":row.try_get::<String>("","operador_uid").map_err(erro)?,
            "tipo":row.try_get::<String>("","tipo").map_err(erro)?,
            "valorCentavos":row.try_get::<i64>("","valor_centavos").map_err(erro)?,
            "motivo":row.try_get::<String>("","motivo").map_err(erro)?,
            "criadoEm":row.try_get::<String>("","criado_em").map_err(erro)?
        });
        inserir(db, &format!("{uid}:caixa_movimento"), &uid, false, &body).await?;
    }
    Ok(())
}

pub async fn confirmar_operacional<C: ConnectionTrait>(
    db: &C,
    envio: &EnvioApi,
    now: &str,
) -> Result<bool, RepoErro> {
    match envio.operacao {
        OperacaoApi::TurnoAbertura => {
            db.execute(Statement::from_sql_and_values(db.get_database_backend(),
                "UPDATE turno_operacao SET sincronizado_em=? WHERE sync_uid=? AND status='aberto'",
                [now.into(), envio.uid.clone().into()])).await.map_err(erro)?;
            Ok(true)
        }
        OperacaoApi::TurnoFechamento => {
            db.execute(Statement::from_sql_and_values(db.get_database_backend(),
                "UPDATE turno_operacao SET sincronizado_em=? WHERE sync_uid=? AND status='encerrado'",
                [now.into(), envio.uid.clone().into()])).await.map_err(erro)?;
            Ok(true)
        }
        OperacaoApi::CaixaMovimento => {
            if tabela_existe(db, "caixa_movimento").await? {
                db.execute(Statement::from_sql_and_values(db.get_database_backend(),
                    "UPDATE caixa_movimento SET sincronizado_em=? WHERE sync_uid=?",
                    [now.into(), envio.uid.clone().into()])).await.map_err(erro)?;
            }
            Ok(true)
        }
        OperacaoApi::Venda | OperacaoApi::Cancelamento => Ok(false),
    }
}

pub async fn tabela_existe<C: ConnectionTrait>(db: &C, tabela: &str) -> Result<bool, RepoErro> {
    let row = db.query_one(Statement::from_sql_and_values(db.get_database_backend(),
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", [tabela.into()]))
        .await.map_err(erro)?;
    Ok(row.is_some())
}

pub async fn inserir<C: ConnectionTrait>(
    db: &C,
    chave: &str,
    uid: &str,
    cancelamento: bool,
    corpo: &Value,
) -> Result<(), RepoErro> {
    db.execute(Statement::from_sql_and_values(db.get_database_backend(),
        "INSERT INTO nuvem_api_outbox(chave,pedido_uid,cancelamento,corpo)
         VALUES(?,?,?,?) ON CONFLICT(chave) DO NOTHING",
        vec![chave.into(), uid.into(), (cancelamento as i64).into(), corpo.to_string().into()]))
        .await.map_err(erro)?;
    Ok(())
}

pub fn operacao(chave: &str) -> OperacaoApi {
    if chave.ends_with(":turno_abertura") { OperacaoApi::TurnoAbertura }
    else if chave.ends_with(":turno_fechamento") { OperacaoApi::TurnoFechamento }
    else if chave.ends_with(":caixa_movimento") { OperacaoApi::CaixaMovimento }
    else if chave.ends_with(":cancelamento") { OperacaoApi::Cancelamento }
    else { OperacaoApi::Venda }
}
