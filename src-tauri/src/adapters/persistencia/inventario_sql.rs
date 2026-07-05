//! Helpers SQL do inventário, extraídos de `inventario_repo.rs` para manter o
//! limite de 300 linhas (Princípio III). Funções puras de consulta/escrita.

use super::entities::livro::{self, Entity as LivroEntity, Model as LivroModel};
use crate::application::ports_inventario::{DivergenciaView, PendenciaView, SessaoView};
use crate::domain::estoque::TipoMovimento;
use chrono::Local;
use sea_orm::{
    ColumnTrait, ConnectionTrait, DatabaseTransaction, DbErr, EntityTrait, QueryFilter,
    QueryResult, Statement, Value,
};

pub(crate) fn agora() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

/// Acha o livro de uma bipagem: casa `codigo` (o código de barras EAN/ISBN, FR-042).
pub(crate) async fn achar_por_bipagem(
    db: &impl ConnectionTrait,
    codigo_lido: &str,
) -> Result<Option<LivroModel>, DbErr> {
    LivroEntity::find()
        .filter(livro::Column::Ativo.eq(true))
        .filter(livro::Column::Codigo.eq(codigo_lido))
        .one(db)
        .await
}

/// Quantidade já contada de um livro na sessão (0 se não houver linha).
pub(crate) async fn ler_qtd_contada(
    db: &impl ConnectionTrait,
    sessao_id: i64,
    livro_id: i64,
) -> Result<i64, DbErr> {
    Ok(db
        .query_one(Statement::from_sql_and_values(
            db.get_database_backend(),
            "SELECT qtd_contada FROM item_contagem WHERE sessao_id = ? AND livro_id = ?",
            [sessao_id.into(), livro_id.into()],
        ))
        .await?
        .and_then(|r| r.try_get::<i64>("", "qtd_contada").ok())
        .unwrap_or(0))
}

pub(crate) fn sessao_de_row(r: &QueryResult) -> Result<SessaoView, DbErr> {
    Ok(SessaoView {
        id: r.try_get("", "id")?,
        modo: r.try_get("", "modo")?,
        rotulo: r.try_get("", "rotulo")?,
        status: r.try_get("", "status")?,
        aberta_em: r.try_get("", "aberta_em")?,
        fechada_em: r.try_get("", "fechada_em")?,
    })
}

pub(crate) async fn exec(
    c: &impl ConnectionTrait,
    sql: &str,
    vals: Vec<Value>,
) -> Result<(), DbErr> {
    c.execute(Statement::from_sql_and_values(
        c.get_database_backend(),
        sql,
        vals,
    ))
    .await?;
    Ok(())
}

/// Divergências da sessão. `apenas_snapshot` = só linhas com `qtd_sistema`
/// preenchido (sessão fechada); senão usa o estoque atual (ao vivo).
pub(crate) async fn divergencias_query(
    db: &impl ConnectionTrait,
    sessao_id: i64,
    apenas_snapshot: bool,
    incluir_iguais: bool,
) -> Result<Vec<DivergenciaView>, DbErr> {
    let sistema = if apenas_snapshot {
        "i.qtd_sistema"
    } else {
        "l.estoque"
    };
    let extra = if apenas_snapshot {
        "AND i.qtd_sistema IS NOT NULL"
    } else {
        ""
    };
    let sql = format!(
        "SELECT l.codigo AS codigo, l.titulo AS titulo, {sistema} AS sistema,
                i.qtd_contada AS contada
         FROM item_contagem i JOIN livro l ON l.id = i.livro_id
         WHERE i.sessao_id = ? {extra} ORDER BY l.titulo"
    );
    let rows = db
        .query_all(Statement::from_sql_and_values(
            db.get_database_backend(),
            &sql,
            [sessao_id.into()],
        ))
        .await?;
    let mut out = Vec::new();
    for r in &rows {
        let sistema: i64 = r.try_get("", "sistema")?;
        let contada: i64 = r.try_get("", "contada")?;
        if apenas_snapshot && !incluir_iguais && sistema == contada {
            continue;
        }
        out.push(DivergenciaView {
            codigo: r.try_get("", "codigo")?,
            titulo: r.try_get("", "titulo")?,
            qtd_sistema: sistema,
            qtd_contada: contada,
            diferenca: contada - sistema,
        });
    }
    Ok(out)
}

/// Marca (US5) uma pendência como resolvida (`true`) ou reaberta (`false`).
pub(crate) async fn set_pendencia_resolvida(
    db: &impl ConnectionTrait,
    pendencia_id: i64,
    resolvida: bool,
) -> Result<(), DbErr> {
    let v: i64 = resolvida.into();
    exec(
        db,
        "UPDATE pendencia_cadastro SET resolvida = ? WHERE id = ?",
        vec![v.into(), pendencia_id.into()],
    )
    .await
}

pub(crate) async fn pendencias_query(
    db: &impl ConnectionTrait,
    filtro: &str,
    vals: Vec<Value>,
) -> Result<Vec<PendenciaView>, DbErr> {
    let sql = format!(
        "SELECT id, codigo_lido, qtd, resolvida FROM pendencia_cadastro {filtro} ORDER BY id"
    );
    let rows = db
        .query_all(Statement::from_sql_and_values(
            db.get_database_backend(),
            &sql,
            vals,
        ))
        .await?;
    Ok(rows
        .iter()
        .filter_map(|r| {
            Some(PendenciaView {
                id: r.try_get("", "id").ok()?,
                codigo_lido: r.try_get("", "codigo_lido").ok()?,
                qtd: r.try_get("", "qtd").ok()?,
                resolvida: r.try_get::<i64>("", "resolvida").ok()? != 0,
            })
        })
        .collect())
}

/// Aplica os ajustes de contagem da sessão na transação: snapshot do saldo do
/// sistema, movimento `contagem` por divergência e atualização do estoque (FR-027).
pub(crate) async fn aplicar_fechamento(
    txn: &DatabaseTransaction,
    sessao_id: i64,
) -> Result<(), DbErr> {
    let itens = txn
        .query_all(Statement::from_sql_and_values(
            txn.get_database_backend(),
            "SELECT i.livro_id AS livro_id, i.qtd_contada AS contada, l.estoque AS sistema
             FROM item_contagem i JOIN livro l ON l.id = i.livro_id
             WHERE i.sessao_id = ?",
            [sessao_id.into()],
        ))
        .await?;
    let criado_em = agora();
    for r in &itens {
        let livro_id: i64 = r.try_get("", "livro_id")?;
        let contada: i64 = r.try_get("", "contada")?;
        let sistema: i64 = r.try_get("", "sistema")?;
        exec(
            txn,
            "UPDATE item_contagem SET qtd_sistema = ? WHERE sessao_id = ? AND livro_id = ?",
            vec![sistema.into(), sessao_id.into(), livro_id.into()],
        )
        .await?;
        let diff = contada - sistema;
        if diff < 0 {
            // Perda de inventário: livre primeiro, carimbos por último (FR-012),
            // ANTES da baixa física.
            super::destinacao_sql::consumir_carimbos(
                txn,
                livro_id,
                -diff,
                super::destinacao_sql::ModoConsumo::Perda,
            )
            .await?;
        }
        if diff != 0 {
            exec(
                txn,
                "INSERT INTO movimento_estoque
                    (livro_id, tipo, qtd, custo_unit_centavos, fornecedor, motivo, referencia, criado_em)
                 VALUES (?, ?, ?, NULL, NULL, 'inventário', ?, ?)",
                vec![
                    livro_id.into(),
                    TipoMovimento::Contagem.as_str().into(),
                    diff.into(),
                    sessao_id.to_string().into(),
                    criado_em.clone().into(),
                ],
            )
            .await?;
            exec(
                txn,
                "UPDATE livro SET estoque = estoque + ? WHERE id = ?",
                vec![diff.into(), livro_id.into()],
            )
            .await?;
        }
    }
    Ok(())
}
