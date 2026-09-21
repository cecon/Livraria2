use super::api_replica::erro;
use crate::application::api_sync::{EnvioApi, OperacaoApi};
use crate::application::ports::RepoErro;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement, TransactionTrait};
use serde_json::{json, Value};

// Snapshot is frozen only after the entire local sale transaction has committed.
pub(crate) const SNAPSHOT: &str = "SELECT p.sync_uid AS uid, json_object(
 'pedidoUid',p.sync_uid,'numero',p.numero,'cliente',p.cliente,'turno',p.turno,
 'data',p.data,'totalCentavos',p.total_centavos,
 'operadorUid',(SELECT sync_uid FROM usuario WHERE usuario=p.operador),
 'turnoUid',p.turno_uid,'numeroNoTurno',p.numero_no_turno,
 'cancelado',json(CASE WHEN p.cancelado THEN 'true' ELSE 'false' END),
 'itens',json((SELECT json_group_array(json_object(
   'uid',i.sync_uid,'livroUid',i.livro_uid,'codigo',i.codigo,'titulo',i.titulo,
   'precoCentavos',i.preco_centavos,'quantidade',i.qtd))
   FROM item_pedido i WHERE i.pedido_numero=p.numero)),
 'pagamentos',json((SELECT json_group_array(json_object(
   'uid',v.sync_uid,'formaUid',f.sync_uid,'valorCentavos',v.valor_centavos))
   FROM pagamento_pedido v JOIN forma_pagamento f ON f.id=v.forma_id WHERE v.pedido_numero=p.numero))
 ) AS corpo FROM pedido p";

pub async fn preparar(db: &DatabaseConnection) -> Result<(), RepoErro> {
    let tx = db.begin().await.map_err(erro)?;
    let backend = tx.get_database_backend();
    for table in ["pedido", "item_pedido", "pagamento_pedido"] {
        tx.execute(Statement::from_string(
            backend,
            format!(
                "UPDATE {table} SET sync_uid=({}) WHERE sync_uid IS NULL OR sync_uid=''",
                crate::migration::m008::UUID_V4
            ),
        ))
        .await
        .map_err(erro)?;
    }
    super::api_outbox_operacional::preparar_operacionais(&tx).await?;
    let rows = tx
        .query_all(Statement::from_string(
            backend,
            format!("{SNAPSHOT} WHERE p.sincronizado_em IS NULL ORDER BY p.numero LIMIT 500"),
        ))
        .await
        .map_err(erro)?;
    for row in rows {
        let uid: String = row.try_get("", "uid").map_err(erro)?;
        let text: String = row.try_get("", "corpo").map_err(erro)?;
        let body: Value = serde_json::from_str(&text).map_err(erro)?;
        let key = format!("{uid}:venda");
        let original = tx
            .query_one(Statement::from_sql_and_values(
                backend,
                "SELECT corpo,enviada FROM nuvem_api_outbox WHERE chave=?",
                [key.clone().into()],
            ))
            .await
            .map_err(erro)?;
        let (key, cancel, body) = if let Some(original) = original {
            let sent: i64 = original.try_get("", "enviada").map_err(erro)?;
            if sent == 0 {
                continue;
            }
            let snapshot: String = original.try_get("", "corpo").map_err(erro)?;
            let snapshot: Value = serde_json::from_str(&snapshot).map_err(erro)?;
            let mut current = body.clone();
            current["cancelado"] = snapshot["cancelado"].clone();
            if current != snapshot {
                return Err(RepoErro::Persistencia(
                    "Venda enviada foi editada; exige reconciliacao explicita".into(),
                ));
            }
            if body["cancelado"] != true || snapshot["cancelado"] == true {
                return Err(RepoErro::Persistencia(
                    "Pedido pendente nao corresponde a cancelamento API".into(),
                ));
            }
            (
                format!("{uid}:cancelamento"),
                true,
                json!({"pedidoUid":uid}),
            )
        } else {
            let state = tx
                .query_one(Statement::from_sql_and_values(
                    backend,
                    "SELECT estoque_status FROM pedido WHERE sync_uid=?",
                    [uid.clone().into()],
                ))
                .await
                .map_err(erro)?;
            if state
                .and_then(|r| r.try_get::<String>("", "estoque_status").ok())
                .as_deref()
                != Some("pronta")
            {
                return Err(RepoErro::Persistencia(
                    "Pedido legado pendente exige reconciliacao antes da API".into(),
                ));
            }
            (key, false, body)
        };
        super::api_outbox_operacional::inserir(&tx, &key, &uid, cancel, &body).await?;
    }
    tx.commit().await.map_err(erro)
}

pub async fn pendentes(db: &DatabaseConnection) -> Result<Vec<EnvioApi>, RepoErro> {
    let rows = db
        .query_all(Statement::from_string(
            db.get_database_backend(),
            "SELECT chave,pedido_uid,cancelamento,corpo FROM nuvem_api_outbox
         WHERE enviada=0 ORDER BY
         CASE
           WHEN chave LIKE '%:turno_abertura' THEN 1
           WHEN chave LIKE '%:venda' THEN 2
           WHEN chave LIKE '%:cancelamento' THEN 3
           WHEN chave LIKE '%:caixa_movimento' THEN 4
           WHEN chave LIKE '%:turno_fechamento' THEN 5
           ELSE 9
         END, rowid LIMIT 500"
                .to_string(),
        ))
        .await
        .map_err(erro)?;
    rows.into_iter()
        .map(|row| {
            let body: String = row.try_get("", "corpo").map_err(erro)?;
            let key: String = row.try_get("", "chave").map_err(erro)?;
            let operacao = super::api_outbox_operacional::operacao(&key);
            let cancelamento = operacao == OperacaoApi::Cancelamento;
            Ok(EnvioApi {
                chave: key,
                uid: row.try_get("", "pedido_uid").map_err(erro)?,
                operacao,
                cancelamento,
                corpo: serde_json::from_str(&body).map_err(erro)?,
            })
        })
        .collect()
}

pub async fn confirmar(
    db: &DatabaseConnection,
    envio: &EnvioApi,
    resposta: &Value,
) -> Result<(), RepoErro> {
    let tx = db.begin().await.map_err(erro)?;
    let backend = tx.get_database_backend();
    let now = chrono::Utc::now().to_rfc3339();
    tx.execute(Statement::from_sql_and_values(
        backend,
        "UPDATE nuvem_api_outbox SET enviada=1 WHERE chave=?",
        [envio.chave.clone().into()],
    ))
    .await
    .map_err(erro)?;
    if super::api_outbox_operacional::confirmar_operacional(&tx, envio, &now).await? {
        return tx.commit().await.map_err(erro);
    }
    let row = tx
        .query_one(Statement::from_sql_and_values(
            backend,
            format!("{SNAPSHOT} WHERE p.sync_uid=?"),
            [envio.uid.clone().into()],
        ))
        .await
        .map_err(erro)?;
    let current: Option<Value> = row
        .map(|r| {
            let text: String = r.try_get("", "corpo").map_err(erro)?;
            serde_json::from_str(&text).map_err(erro)
        })
        .transpose()?;
    let matches = if envio.cancelamento {
        current.as_ref().is_some_and(|v| v["cancelado"] == true)
    } else {
        current.as_ref() == Some(&envio.corpo)
    };
    if matches {
        let state = resposta.get("estoqueStatus").and_then(Value::as_str);
        if let Some(state) = state {
            tx.execute(Statement::from_sql_and_values(
                backend,
                "UPDATE pedido SET estoque_status=? WHERE sync_uid=?",
                [state.into(), envio.uid.clone().into()],
            ))
            .await
            .map_err(erro)?;
        }
        tx.execute(Statement::from_sql_and_values(
            backend,
            "UPDATE pedido SET sincronizado_em=? WHERE sync_uid=?",
            [now.clone().into(), envio.uid.clone().into()],
        ))
        .await
        .map_err(erro)?;
        for table in ["item_pedido", "pagamento_pedido"] {
            tx.execute(Statement::from_sql_and_values(backend, format!(
                "UPDATE {table} SET sincronizado_em=? WHERE pedido_numero=(SELECT numero FROM pedido WHERE sync_uid=?)"),
                [now.clone().into(), envio.uid.clone().into()])).await.map_err(erro)?;
        }
    }
    tx.commit().await.map_err(erro)
}
