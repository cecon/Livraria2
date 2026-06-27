//! Helpers SQL de lançamentos (ADR-0011), extraídos para manter o limite de 300
//! linhas. Montagem de detalhe/resumos e aplicação atômica da finalização.

use super::estoque_sql::{agora, inserir_entrada_item, inserir_movimento, ler_saldo};
use crate::application::ports_compras::{
    ItemNota, LancamentoDetalhe, LancamentoResumo, PaginaLancamentos,
};
use crate::domain::estoque::TipoMovimento;
use sea_orm::{ConnectionTrait, DatabaseTransaction, DbErr, Statement};

/// Itens de uma nota (com título do livro e subtotal).
pub(crate) async fn itens(
    db: &impl ConnectionTrait,
    id: i64,
) -> Result<Vec<ItemNota>, DbErr> {
    let rows = db
        .query_all(Statement::from_sql_and_values(
            db.get_database_backend(),
            "SELECT i.id AS item_id, lv.codigo AS codigo, lv.titulo AS titulo,
                    i.qtd AS qtd, i.custo_unit_centavos AS custo
             FROM item_lancamento i JOIN livro lv ON lv.id = i.livro_id
             WHERE i.lancamento_id = ? ORDER BY i.id",
            [id.into()],
        ))
        .await?;
    let mut out = Vec::new();
    for r in &rows {
        let qtd: i64 = r.try_get("", "qtd")?;
        let custo: i64 = r.try_get("", "custo")?;
        out.push(ItemNota {
            item_id: r.try_get("", "item_id")?,
            codigo: r.try_get("", "codigo")?,
            titulo: r.try_get("", "titulo")?,
            qtd,
            custo_unit_centavos: custo,
            subtotal_centavos: qtd * custo,
        });
    }
    Ok(out)
}

/// Detalhe completo de uma nota (cabeçalho + itens), se existir.
pub(crate) async fn detalhe(
    db: &impl ConnectionTrait,
    id: i64,
) -> Result<Option<LancamentoDetalhe>, DbErr> {
    let row = db
        .query_one(Statement::from_sql_and_values(
            db.get_database_backend(),
            "SELECT l.id, l.fornecedor_id, f.nome AS fornecedor_nome, l.numero, l.data, l.status
             FROM lancamento_entrada l LEFT JOIN fornecedor f ON f.id = l.fornecedor_id
             WHERE l.id = ?",
            [id.into()],
        ))
        .await?;
    let Some(r) = row else { return Ok(None) };
    let itens = itens(db, id).await?;
    let total = itens.iter().map(|i| i.subtotal_centavos).sum();
    Ok(Some(LancamentoDetalhe {
        id: r.try_get("", "id")?,
        fornecedor_id: r.try_get("", "fornecedor_id")?,
        fornecedor_nome: r.try_get("", "fornecedor_nome")?,
        numero: r.try_get("", "numero")?,
        data: r.try_get("", "data")?,
        status: r.try_get("", "status")?,
        total_centavos: total,
        itens,
    }))
}

/// Página de notas (mais recentes primeiro) com total, para paginação no banco.
pub(crate) async fn pagina(
    db: &impl ConnectionTrait,
    limite: i64,
    offset: i64,
) -> Result<PaginaLancamentos, DbErr> {
    let total: i64 = db
        .query_one(Statement::from_string(
            db.get_database_backend(),
            "SELECT COUNT(*) AS n FROM lancamento_entrada".to_string(),
        ))
        .await?
        .and_then(|r| r.try_get::<i64>("", "n").ok())
        .unwrap_or(0);
    let rows = db
        .query_all(Statement::from_sql_and_values(
            db.get_database_backend(),
            "SELECT l.id, f.nome AS fornecedor_nome, l.data, l.status,
                COALESCE((SELECT SUM(qtd * custo_unit_centavos) FROM item_lancamento
                          WHERE lancamento_id = l.id), 0) AS total,
                (SELECT COUNT(*) FROM item_lancamento WHERE lancamento_id = l.id) AS qtd_itens
             FROM lancamento_entrada l LEFT JOIN fornecedor f ON f.id = l.fornecedor_id
             ORDER BY l.id DESC LIMIT ? OFFSET ?",
            [limite.into(), offset.into()],
        ))
        .await?;
    let itens = rows
        .iter()
        .filter_map(|r| {
            Some(LancamentoResumo {
                id: r.try_get("", "id").ok()?,
                fornecedor_nome: r.try_get("", "fornecedor_nome").ok()?,
                data: r.try_get("", "data").ok()?,
                status: r.try_get("", "status").ok()?,
                total_centavos: r.try_get("", "total").ok()?,
                qtd_itens: r.try_get("", "qtd_itens").ok()?,
            })
        })
        .collect();
    Ok(PaginaLancamentos { itens, total })
}

/// Aplica a finalização na transação: 1 entrada por item (helper compartilhado) +
/// marca a nota como `finalizada`. O fornecedor (nome) vai no movimento; `referencia` = id.
pub(crate) async fn aplicar_finalizacao(
    txn: &DatabaseTransaction,
    id: i64,
) -> Result<(), DbErr> {
    let nome = txn
        .query_one(Statement::from_sql_and_values(
            txn.get_database_backend(),
            "SELECT f.nome AS nome FROM lancamento_entrada l
             LEFT JOIN fornecedor f ON f.id = l.fornecedor_id WHERE l.id = ?",
            [id.into()],
        ))
        .await?
        .and_then(|r| r.try_get::<String>("", "nome").ok());
    let itens = txn
        .query_all(Statement::from_sql_and_values(
            txn.get_database_backend(),
            "SELECT lv.codigo AS livro_codigo, i.qtd AS qtd, i.custo_unit_centavos AS custo_unit_centavos
             FROM item_lancamento i JOIN livro lv ON lv.id = i.livro_id
             WHERE i.lancamento_id = ?",
            [id.into()],
        ))
        .await?;
    for r in &itens {
        let codigo: String = r.try_get("", "livro_codigo")?;
        let qtd: i64 = r.try_get("", "qtd")?;
        let custo: i64 = r.try_get("", "custo_unit_centavos")?;
        inserir_entrada_item(txn, &codigo, qtd, custo, nome.clone(), Some(id.to_string())).await?;
    }
    txn.execute(Statement::from_sql_and_values(
        txn.get_database_backend(),
        "UPDATE lancamento_entrada SET status = 'finalizada', finalizada_em = ? WHERE id = ?",
        [agora().into(), id.into()],
    ))
    .await?;
    Ok(())
}

/// Cancela uma nota finalizada por **estorno**: gera um movimento `estorno` (−qtd) por
/// item, reverte o estoque e marca `cancelada`. Bloqueia se o estoque já foi consumido.
pub(crate) async fn aplicar_cancelamento(
    txn: &DatabaseTransaction,
    id: i64,
) -> Result<(), DbErr> {
    let itens = txn
        .query_all(Statement::from_sql_and_values(
            txn.get_database_backend(),
            "SELECT lv.codigo AS livro_codigo, i.qtd AS qtd
             FROM item_lancamento i JOIN livro lv ON lv.id = i.livro_id
             WHERE i.lancamento_id = ?",
            [id.into()],
        ))
        .await?;
    let motivo = format!("cancelamento da nota #{id}");
    for r in &itens {
        let codigo: String = r.try_get("", "livro_codigo")?;
        let qtd: i64 = r.try_get("", "qtd")?;
        let (estoque, _) = ler_saldo(txn, &codigo).await?;
        if estoque < qtd {
            return Err(DbErr::Custom(format!(
                "Não é possível cancelar: o estoque de '{codigo}' já foi movimentado/vendido."
            )));
        }
        inserir_movimento(
            txn,
            &codigo,
            TipoMovimento::Estorno,
            -qtd,
            None,
            None,
            Some(motivo.clone()),
            Some(id.to_string()),
        )
        .await?;
        txn.execute(Statement::from_sql_and_values(
            txn.get_database_backend(),
            "UPDATE livro SET estoque = estoque - ? WHERE codigo = ?",
            [qtd.into(), codigo.into()],
        ))
        .await?;
    }
    txn.execute(Statement::from_sql_and_values(
        txn.get_database_backend(),
        "UPDATE lancamento_entrada SET status = 'cancelada' WHERE id = ?",
        [id.into()],
    ))
    .await?;
    Ok(())
}
