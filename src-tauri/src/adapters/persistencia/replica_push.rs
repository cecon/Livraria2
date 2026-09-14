//! O lado que SOBE da réplica: seleciona os pendentes já no formato da nuvem
//! (ver `replica_mapa`) e marca o lote como enviado.
//!
//! Separado de `replica_sync` (que ficou com o lado que desce) para manter cada
//! arquivo sob 300 linhas — Princípio III.

use super::replica_mapa::{expr_json, pull_only, spec};
use crate::application::ports::RepoErro;
use crate::application::ports_sync::RegistroSync;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};

fn erro(e: impl std::fmt::Display) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

async fn exec(db: &DatabaseConnection, sql: String) -> Result<(), RepoErro> {
    db.execute(Statement::from_string(db.get_database_backend(), sql))
        .await
        .map(|_| ())
        .map_err(erro)
}

/// Registros locais ainda não enviados, no JSON que a nuvem espera.
pub(crate) async fn pendentes(
    db: &DatabaseConnection,
    recurso: &str,
) -> Result<Vec<RegistroSync>, RepoErro> {
    let Some(s) = spec(recurso) else { return Ok(vec![]) };
    // Cadastros de autoridade da nuvem (feature 012, US2): pull-only — o PDV nunca
    // empurra fornecedor/forma_pagamento/destinacao (a edição vive no escritório).
    if pull_only(recurso) {
        return Ok(vec![]);
    }
    // Atribui sync_uid (lazy) às linhas novas — inserts do app não o preenchem.
    exec(
        db,
        format!(
            "UPDATE {recurso} SET sync_uid=({}) WHERE sync_uid IS NULL OR sync_uid=''",
            crate::migration::m008::UUID_V4
        ),
    )
    .await?;
    let filtro = if recurso == "movimento_estoque" {
        "sincronizado_em IS NULL AND tipo NOT IN ('saida_venda','estorno')"
    } else {
        "sincronizado_em IS NULL"
    };
    let sql = format!("SELECT {} AS j, sync_uid AS u FROM {} t WHERE {filtro}", expr_json(s), recurso);
    let rows = db
        .query_all(Statement::from_string(db.get_database_backend(), sql))
        .await
        .map_err(erro)?;
    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let j: String = r.try_get("", "j").map_err(erro)?;
        let dados: serde_json::Value = serde_json::from_str(&j).map_err(erro)?;
        out.push(RegistroSync {
            recurso: recurso.to_string(),
            sync_uid: r.try_get("", "u").map_err(erro)?,
            atualizado_em: dados.get("atualizado_em").and_then(|v| v.as_str()).map(str::to_string),
            excluido_em: dados.get("excluido_em").and_then(|v| v.as_str()).map(str::to_string),
            dados,
        });
    }
    Ok(out)
}

/// Marca o lote como enviado (o push confirma em blocos — retomável).
pub(crate) async fn marcar_sincronizado(
    db: &DatabaseConnection,
    recurso: &str,
    uids: &[String],
    quando: &str,
) -> Result<(), RepoErro> {
    if uids.is_empty() {
        return Ok(());
    }
    let marca = format!("'{}'", quando.replace('\'', "''"));
    let lista = uids
        .iter()
        .map(|u| format!("'{}'", u.replace('\'', "''")))
        .collect::<Vec<_>>()
        .join(",");
    exec(
        db,
        format!("UPDATE {recurso} SET sincronizado_em={marca} WHERE sync_uid IN ({lista})"),
    )
    .await
}
