//! Consultas do **inventário realizado** (US3, FR-010/011/012/015): lista de
//! sessões fechadas/canceladas e montagem do relatório só-leitura. Extraído de
//! `inventario_sql`/`inventario_repo` para respeitar o limite de 300 linhas.

use super::inventario_sql::{divergencias_query, pendencias_query, sessao_de_row};
use crate::application::ports_inventario::{RelatorioView, ResumoView, SessaoView};
use crate::domain::inventario::resumir;
use sea_orm::{ConnectionTrait, DbErr, Statement};

/// Sessões já realizadas (fechadas/canceladas), mais recentes primeiro.
pub(crate) async fn sessoes_realizadas_query(
    db: &impl ConnectionTrait,
) -> Result<Vec<SessaoView>, DbErr> {
    let rows = db
        .query_all(Statement::from_string(
            db.get_database_backend(),
            "SELECT id, modo, rotulo, status, aberta_em, fechada_em FROM sessao_inventario
             WHERE status IN ('fechada','cancelada') ORDER BY id DESC"
                .to_string(),
        ))
        .await?;
    rows.iter().map(sessao_de_row).collect()
}

/// Uma sessão por id (qualquer status), para o relatório só-leitura.
pub(crate) async fn sessao_por_id(
    db: &impl ConnectionTrait,
    sessao_id: i64,
) -> Result<Option<SessaoView>, DbErr> {
    let row = db
        .query_one(Statement::from_sql_and_values(
            db.get_database_backend(),
            "SELECT id, modo, rotulo, status, aberta_em, fechada_em FROM sessao_inventario WHERE id = ?",
            [sessao_id.into()],
        ))
        .await?;
    row.as_ref().map(sessao_de_row).transpose()
}

/// Monta o relatório só-leitura: sessão + agregados (domínio `resumir`) +
/// itens (snapshot, inclui os que bateram) + pendências da sessão.
pub(crate) async fn montar_relatorio(
    db: &impl ConnectionTrait,
    sessao_id: i64,
) -> Result<RelatorioView, DbErr> {
    let sessao = sessao_por_id(db, sessao_id)
        .await?
        .ok_or_else(|| DbErr::Custom("sessão não encontrada".into()))?;
    let itens = divergencias_query(db, sessao_id, true, true).await?;
    let pares: Vec<(i64, i64)> = itens.iter().map(|d| (d.qtd_sistema, d.qtd_contada)).collect();
    let r = resumir(&pares);
    let pendencias = pendencias_query(db, "WHERE sessao_id = ?", vec![sessao_id.into()]).await?;
    Ok(RelatorioView {
        sessao,
        resumo: ResumoView {
            total: r.total,
            bateram: r.bateram,
            faltaram: r.faltaram,
            sobraram: r.sobraram,
            soma_diferencas: r.soma_diferencas,
        },
        itens,
        pendencias,
    })
}
