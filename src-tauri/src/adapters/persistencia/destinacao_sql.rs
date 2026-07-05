//! Helpers SQL dos saldos carimbados (ADR-0014). Fonte única da mecânica de
//! carimbo: transferência (US1), leitura de saldos e histórico. O consumo nas
//! saídas (venda/perda) entra pelos mesmos helpers (D4).

use super::estoque_sql::agora;
use crate::application::ports_destinacao::{CarimboSaldo, SaldoLivro, TransferenciaReg};
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

/// Saldos de um livro: físico, carimbos em ordem e livre (resíduo — D1).
pub(crate) async fn saldos_livro<C: ConnectionTrait>(
    conn: &C,
    livro_codigo: &str,
) -> Result<SaldoLivro, DbErr> {
    let livro_id = livro_id_por_codigo(conn, livro_codigo).await?;
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
    let carimbado: i64 = carimbos.iter().map(|c| c.qtd).sum();
    Ok(SaldoLivro {
        estoque,
        livre: estoque - carimbado,
        carimbos,
    })
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

/// Move carimbo entre origem e destino (`None` = livre) e registra a trilha (FR-007).
/// Guards de negócio ficam no caso de uso; aqui só a mecânica atômica.
pub(crate) async fn transferir<C: ConnectionTrait>(
    conn: &C,
    livro_codigo: &str,
    de: Option<i64>,
    para: Option<i64>,
    qtd: i64,
    motivo: Option<String>,
) -> Result<(), DbErr> {
    let livro_id = livro_id_por_codigo(conn, livro_codigo).await?;
    if let Some(id) = de {
        somar_carimbo(conn, livro_id, id, -qtd).await?;
    }
    if let Some(id) = para {
        somar_carimbo(conn, livro_id, id, qtd).await?;
    }
    conn.execute(Statement::from_sql_and_values(
        conn.get_database_backend(),
        "INSERT INTO transferencia_destinacao
            (livro_id, de_destinacao_id, para_destinacao_id, qtd, motivo, criado_em)
         VALUES (?, ?, ?, ?, ?, ?)",
        [
            livro_id.into(),
            de.into(),
            para.into(),
            qtd.into(),
            motivo.into(),
            agora().into(),
        ],
    ))
    .await?;
    Ok(())
}

/// Histórico de transferências do livro, mais recente primeiro (US1).
pub(crate) async fn transferencias_livro<C: ConnectionTrait>(
    conn: &C,
    livro_codigo: &str,
) -> Result<Vec<TransferenciaReg>, DbErr> {
    let livro_id = livro_id_por_codigo(conn, livro_codigo).await?;
    let rows = conn
        .query_all(Statement::from_sql_and_values(
            conn.get_database_backend(),
            "SELECT t.id AS id, dd.nome AS de, dp.nome AS para, t.qtd AS qtd,
                    t.motivo AS motivo, t.criado_em AS criado_em
             FROM transferencia_destinacao t
             LEFT JOIN destinacao dd ON dd.id = t.de_destinacao_id
             LEFT JOIN destinacao dp ON dp.id = t.para_destinacao_id
             WHERE t.livro_id = ?
             ORDER BY t.id DESC",
            [livro_id.into()],
        ))
        .await?;
    rows.into_iter()
        .map(|r| {
            Ok(TransferenciaReg {
                id: r.try_get("", "id")?,
                de: r.try_get("", "de").ok(),
                para: r.try_get("", "para").ok(),
                qtd: r.try_get("", "qtd")?,
                motivo: r.try_get("", "motivo").ok().flatten(),
                criado_em: r.try_get("", "criado_em")?,
            })
        })
        .collect()
}
