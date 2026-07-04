//! SQL da junção `pagamento_pedido` (recebimentos de uma venda — ADR-0013).
//! Separado de `pedido_repo.rs` para manter o limite de 300 linhas (Princípio III).

use crate::application::ports::RecebimentoRelatorio;
use crate::domain::pedido::Pagamentos;
use sea_orm::{ConnectionTrait, DbErr, Statement};

/// Grava as linhas de recebimento de um pedido (esparso: só valor > 0).
pub async fn inserir(
    c: &impl ConnectionTrait,
    pedido_numero: i64,
    pagamentos: &Pagamentos,
) -> Result<(), DbErr> {
    for r in pagamentos {
        if r.valor.centavos() <= 0 {
            continue;
        }
        c.execute(Statement::from_sql_and_values(
            c.get_database_backend(),
            "INSERT INTO pagamento_pedido (pedido_numero, forma_id, valor_centavos)
             VALUES (?, ?, ?)
             ON CONFLICT(pedido_numero, forma_id)
             DO UPDATE SET valor_centavos = valor_centavos + excluded.valor_centavos",
            [pedido_numero.into(), r.forma_id.into(), r.valor.centavos().into()],
        ))
        .await?;
    }
    Ok(())
}

/// Recebimentos de um pedido com chave/rótulo da forma, ordenados por `ordem` (FR-019).
pub async fn por_pedido(
    c: &impl ConnectionTrait,
    pedido_numero: i64,
) -> Result<Vec<RecebimentoRelatorio>, DbErr> {
    let rows = c
        .query_all(Statement::from_sql_and_values(
            c.get_database_backend(),
            "SELECT pp.forma_id, f.chave, f.rotulo, pp.valor_centavos
             FROM pagamento_pedido pp
             JOIN forma_pagamento f ON f.id = pp.forma_id
             WHERE pp.pedido_numero = ?
             ORDER BY f.ordem, f.id",
            [pedido_numero.into()],
        ))
        .await?;
    let mut saida = Vec::with_capacity(rows.len());
    for r in &rows {
        saida.push(RecebimentoRelatorio {
            forma_id: r.try_get("", "forma_id")?,
            chave: r.try_get("", "chave")?,
            rotulo: r.try_get("", "rotulo")?,
            valor_centavos: r.try_get("", "valor_centavos")?,
        });
    }
    Ok(saida)
}
