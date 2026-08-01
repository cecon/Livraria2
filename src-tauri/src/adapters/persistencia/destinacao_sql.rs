//! Helpers SQL dos saldos carimbados (ADR-0014). Fonte única da mecânica de
//! carimbo: transferência (US1), leitura de saldos e histórico. O consumo nas
//! saídas (venda/perda) entra pelos mesmos helpers (D4).

use crate::application::ports_destinacao::CarimboSaldo;
use crate::domain::alocacao::{alocar_venda, Alocacao};
use sea_orm::{ConnectionTrait, DbErr, Statement};

/// Resolve o id do livro pelo código (identidade da UI — ADR-0012).
pub(crate) async fn livro_id_por_codigo<C: ConnectionTrait>(
    conn: &C,
    codigo: &str,
) -> Result<i64, DbErr> {
    let row = conn
        .query_one(Statement::from_sql_and_values(
            conn.get_database_backend(),
            "SELECT id FROM livro WHERE codigo = ?",
            [codigo.into()],
        ))
        .await?
        .ok_or_else(|| DbErr::Custom("livro não encontrado".into()))?;
    row.try_get("", "id")
}

/// Carimbos de um livro na ordem de baixa (cadastro: Loja=0 primeiro), só qtd > 0.
pub(crate) async fn carimbos_ordenados<C: ConnectionTrait>(
    conn: &C,
    livro_id: i64,
) -> Result<Vec<CarimboSaldo>, DbErr> {
    let rows = conn
        .query_all(Statement::from_sql_and_values(
            conn.get_database_backend(),
            "SELECT ds.destinacao_id AS id, d.nome AS nome, ds.qtd AS qtd
             FROM destinacao_saldo ds JOIN destinacao d ON d.id = ds.destinacao_id
             WHERE ds.livro_id = ? AND ds.qtd > 0
             ORDER BY d.ordem, d.id",
            [livro_id.into()],
        ))
        .await?;
    rows.into_iter()
        .map(|r| {
            Ok(CarimboSaldo {
                destinacao_id: r.try_get("", "id")?,
                nome: r.try_get("", "nome")?,
                qtd: r.try_get("", "qtd")?,
            })
        })
        .collect()
}


/// Soma `delta` ao carimbo (upsert); remove a linha quando zera (tabela enxuta).
pub(crate) async fn somar_carimbo<C: ConnectionTrait>(
    conn: &C,
    livro_id: i64,
    destinacao_id: i64,
    delta: i64,
) -> Result<(), DbErr> {
    let backend = conn.get_database_backend();
    conn.execute(Statement::from_sql_and_values(
        backend,
        "INSERT INTO destinacao_saldo (livro_id, destinacao_id, qtd) VALUES (?, ?, ?)
         ON CONFLICT(livro_id, destinacao_id) DO UPDATE SET qtd = qtd + excluded.qtd",
        [livro_id.into(), destinacao_id.into(), delta.into()],
    ))
    .await?;
    conn.execute(Statement::from_sql_and_values(
        backend,
        "DELETE FROM destinacao_saldo WHERE livro_id = ? AND destinacao_id = ? AND qtd <= 0",
        [livro_id.into(), destinacao_id.into()],
    ))
    .await?;
    Ok(())
}



/// Consome `qtd` dos saldos do livro numa VENDA (carimbos na ordem do cadastro,
/// Loja 1ª → livre). **Chamar ANTES da baixa física** — o livre é derivado do
/// estoque atual (`estoque − Σ carimbos`). Decrementa os carimbos consumidos e
/// retorna as alocações (inclusive a parte do livre, `None`).
pub(crate) async fn consumir_carimbos<C: ConnectionTrait>(
    conn: &C,
    livro_id: i64,
    qtd: i64,
) -> Result<Vec<Alocacao>, DbErr> {
    if qtd <= 0 {
        return Ok(vec![]);
    }
    let row = conn
        .query_one(Statement::from_sql_and_values(
            conn.get_database_backend(),
            "SELECT estoque FROM livro WHERE id = ?",
            [livro_id.into()],
        ))
        .await?
        .ok_or_else(|| DbErr::Custom("livro não encontrado".into()))?;
    let estoque: i64 = row.try_get("", "estoque")?;
    let carimbos = carimbos_ordenados(conn, livro_id).await?;
    let pares: Vec<(i64, i64)> = carimbos.iter().map(|c| (c.destinacao_id, c.qtd)).collect();
    let livre = estoque - pares.iter().map(|(_, q)| q).sum::<i64>();
    let alocacoes = alocar_venda(&pares, livre, qtd).map_err(|e| DbErr::Custom(e.to_string()))?;
    for a in &alocacoes {
        if let Some(id) = a.destinacao_id {
            somar_carimbo(conn, livro_id, id, -a.qtd).await?;
        }
    }
    Ok(alocacoes)
}

/// Grava as linhas de alocação da venda — só carimbos (o livre é derivado, D3).
/// `valor = qtd × preço unitário` (inteiro, sem rateio de centavos — D6).
pub(crate) async fn gravar_alocacoes<C: ConnectionTrait>(
    conn: &C,
    pedido_numero: i64,
    item_id: i64,
    preco_centavos: i64,
    alocacoes: &[Alocacao],
) -> Result<(), DbErr> {
    for a in alocacoes {
        let Some(destinacao_id) = a.destinacao_id else { continue };
        conn.execute(Statement::from_sql_and_values(
            conn.get_database_backend(),
            "INSERT INTO alocacao_venda (pedido_numero, item_id, destinacao_id, qtd, valor_centavos)
             VALUES (?, ?, ?, ?, ?)",
            [
                pedido_numero.into(),
                item_id.into(),
                destinacao_id.into(),
                a.qtd.into(),
                (a.qtd * preco_centavos).into(),
            ],
        ))
        .await?;
    }
    Ok(())
}

/// Devolve os carimbos consumidos pelas alocações do pedido (estorno de venda —
/// FR-010). As linhas PERMANECEM: o relatório exclui via `pedido.cancelado`.
pub(crate) async fn devolver_alocacoes_pedido<C: ConnectionTrait>(
    conn: &C,
    numero: i64,
) -> Result<(), DbErr> {
    let rows = conn
        .query_all(Statement::from_sql_and_values(
            conn.get_database_backend(),
            "SELECT a.destinacao_id AS destinacao_id, a.qtd AS qtd,
                    (SELECT id FROM livro WHERE codigo = ip.codigo) AS livro_id
             FROM alocacao_venda a JOIN item_pedido ip ON ip.id = a.item_id
             WHERE a.pedido_numero = ?",
            [numero.into()],
        ))
        .await?;
    for r in &rows {
        let livro_id: i64 = r.try_get("", "livro_id")?;
        let destinacao_id: i64 = r.try_get("", "destinacao_id")?;
        let qtd: i64 = r.try_get("", "qtd")?;
        somar_carimbo(conn, livro_id, destinacao_id, qtd).await?;
    }
    Ok(())
}

/// Devolve e REMOVE as alocações de um item (exclusão de item é correção de
/// dados num pedido ativo — as linhas não podem sobrar no relatório).
pub(crate) async fn devolver_alocacoes_item<C: ConnectionTrait>(
    conn: &C,
    item_id: i64,
) -> Result<(), DbErr> {
    let rows = conn
        .query_all(Statement::from_sql_and_values(
            conn.get_database_backend(),
            "SELECT a.destinacao_id AS destinacao_id, a.qtd AS qtd,
                    (SELECT id FROM livro WHERE codigo = ip.codigo) AS livro_id
             FROM alocacao_venda a JOIN item_pedido ip ON ip.id = a.item_id
             WHERE a.item_id = ?",
            [item_id.into()],
        ))
        .await?;
    for r in &rows {
        let livro_id: i64 = r.try_get("", "livro_id")?;
        let destinacao_id: i64 = r.try_get("", "destinacao_id")?;
        let qtd: i64 = r.try_get("", "qtd")?;
        somar_carimbo(conn, livro_id, destinacao_id, qtd).await?;
    }
    conn.execute(Statement::from_sql_and_values(
        conn.get_database_backend(),
        "DELETE FROM alocacao_venda WHERE item_id = ?",
        [item_id.into()],
    ))
    .await?;
    Ok(())
}
