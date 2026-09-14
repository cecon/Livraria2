//! Recomputação de derivados do livro (saldo + custo_medio) pelo fold do ledger
//! após uma sincronização (ADR-0008/0009). A regra é pura (`domain::estoque`);
//! aqui só lê os movimentos ordenados e grava o resultado.

use crate::application::ports::RepoErro;
use crate::domain::estoque::recompor_ledger;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement, Value};

fn erro(e: impl std::fmt::Display) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

/// Recompõe `estoque` e `custo_medio_centavos` dos livros indicados (por `sync_uid`).
pub async fn recompor(db: &DatabaseConnection, livros_uid: &[String]) -> Result<(), RepoErro> {
    let backend = db.get_database_backend();
    for uid in livros_uid {
        let u = uid.replace('\'', "''");
        let rows = db
            .query_all(Statement::from_string(
                backend,
                format!(
                    "SELECT m.qtd AS q, m.custo_unit_centavos AS c FROM movimento_estoque m \
                     JOIN livro l ON l.id = m.livro_id \
                     WHERE l.sync_uid='{u}' AND (m.excluido_em IS NULL OR m.excluido_em='') \
                     ORDER BY m.criado_em, m.id"
                ),
            ))
            .await
            .map_err(erro)?;
        let mut movs = Vec::with_capacity(rows.len());
        for r in &rows {
            let q: i64 = r.try_get("", "q").map_err(erro)?;
            let c: Option<i64> = r.try_get("", "c").map_err(erro)?;
            movs.push((q, c));
        }
        let (saldo, medio) = recompor_ledger(&movs);
        db.execute(Statement::from_sql_and_values(
            backend,
            "UPDATE livro SET estoque=?, custo_medio_centavos=? WHERE sync_uid=?",
            vec![
                Value::BigInt(Some(saldo)),
                Value::BigInt(Some(medio.centavos())),
                Value::String(Some(Box::new(uid.clone()))),
            ],
        ))
        .await
        .map_err(erro)?;
    }
    Ok(())
}
