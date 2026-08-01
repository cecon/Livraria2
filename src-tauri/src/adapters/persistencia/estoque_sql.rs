//! Helper SQL do ledger de estoque (ADR-0008/0009): inserção append-only de
//! movimento. Feature 012: o PDV só grava o `saldo_inicial` (baseline) — entrada
//! e ajuste são contabilidade oficial e vivem na nuvem.

use crate::domain::estoque::TipoMovimento;
use chrono::Local;
use sea_orm::{ConnectionTrait, DatabaseTransaction, DbErr, Statement};

pub(crate) fn agora() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

/// Insere uma linha no ledger (append-only). Não há caminho de update/delete (FR-005).
#[allow(clippy::too_many_arguments)]
pub(crate) async fn inserir_movimento(
    txn: &DatabaseTransaction,
    livro_codigo: &str,
    tipo: TipoMovimento,
    qtd: i64,
    custo_unit: Option<i64>,
    fornecedor: Option<String>,
    motivo: Option<String>,
    referencia: Option<String>,
) -> Result<(), DbErr> {
    let backend = txn.get_database_backend();
    txn.execute(Statement::from_sql_and_values(
        backend,
        "INSERT INTO movimento_estoque
            (livro_id, tipo, qtd, custo_unit_centavos, fornecedor, motivo, referencia, criado_em)
         VALUES ((SELECT id FROM livro WHERE codigo = ?), ?, ?, ?, ?, ?, ?, ?)",
        [
            livro_codigo.into(),
            tipo.as_str().into(),
            qtd.into(),
            custo_unit.into(),
            fornecedor.into(),
            motivo.into(),
            referencia.into(),
            agora().into(),
        ],
    ))
    .await?;
    Ok(())
}

