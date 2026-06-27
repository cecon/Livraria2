//! Helpers SQL do ledger de estoque (ADR-0008/0009). Fonte única da mecânica de
//! inserção de movimento + atualização de saldo, compartilhada por `estoque_repo`
//! (entrada de 1 item) e `lancamento_repo` (finalização de nota multi-item) — D3a/DRY.

use crate::domain::dinheiro::Dinheiro;
use crate::domain::estoque::{custo_medio_apos_entrada, TipoMovimento};
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

/// Lê (estoque, custo_medio_centavos) do livro dentro da transação.
pub(crate) async fn ler_saldo(
    txn: &DatabaseTransaction,
    codigo: &str,
) -> Result<(i64, i64), DbErr> {
    let backend = txn.get_database_backend();
    let row = txn
        .query_one(Statement::from_sql_and_values(
            backend,
            "SELECT estoque, custo_medio_centavos FROM livro WHERE codigo = ?",
            [codigo.into()],
        ))
        .await?
        .ok_or_else(|| DbErr::Custom("livro não encontrado".into()))?;
    Ok((row.try_get("", "estoque")?, row.try_get("", "custo_medio_centavos")?))
}

/// **Helper compartilhado (D3a)**: registra a entrada de UM item dentro da transação —
/// insere movimento `entrada`, soma o estoque e recalcula o custo médio ponderado.
pub(crate) async fn inserir_entrada_item(
    txn: &DatabaseTransaction,
    livro_codigo: &str,
    qtd: i64,
    custo_unit_centavos: i64,
    fornecedor: Option<String>,
    referencia: Option<String>,
) -> Result<(), DbErr> {
    let (estoque, medio) = ler_saldo(txn, livro_codigo).await?;
    let novo_medio = custo_medio_apos_entrada(
        estoque,
        Dinheiro::de_centavos(medio),
        qtd,
        Dinheiro::de_centavos(custo_unit_centavos),
    );
    inserir_movimento(
        txn,
        livro_codigo,
        TipoMovimento::Entrada,
        qtd,
        Some(custo_unit_centavos),
        fornecedor,
        None,
        referencia,
    )
    .await?;
    let backend = txn.get_database_backend();
    txn.execute(Statement::from_sql_and_values(
        backend,
        "UPDATE livro SET estoque = estoque + ?, custo_medio_centavos = ? WHERE codigo = ?",
        [qtd.into(), novo_medio.centavos().into(), livro_codigo.into()],
    ))
    .await?;
    Ok(())
}
