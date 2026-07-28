//! Comandos Tauri do dashboard.

use crate::adapters::persistencia::dashboard_repo::SeaDashboardRepo;
use crate::application::dashboard;
use crate::commands::{AppState, ErroDto, LivroDto};
use chrono::{Datelike, Duration, Local, NaiveDate};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardDto {
    pub vendas_centavos: i64,
    pub itens_vendidos: i64,
    pub ticket_medio_centavos: i64,
    pub total_livros: i64,
    pub total_estoque: i64,
    pub estoque_baixo: Vec<LivroDto>,
    pub canceladas_qtd: i64,
    pub canceladas_centavos: i64,
}

fn intervalo_periodo(periodo: Option<&str>) -> (String, String) {
    let hoje = Local::now().date_naive();
    let inicio = match periodo {
        Some("7dias") => hoje - Duration::days(7),
        Some("mes") => hoje.with_day(1).unwrap_or(hoje),
        Some("ano") => NaiveDate::from_ymd_opt(hoje.year(), 1, 1).unwrap_or(hoje),
        _ => hoje,
    };
    let fmt = |d: NaiveDate| d.format("%Y-%m-%d").to_string();
    (fmt(inicio), fmt(hoje))
}

#[tauri::command]
pub async fn dashboard_do_dia(
    state: tauri::State<'_, AppState>,
    periodo: Option<String>,
) -> Result<DashboardDto, ErroDto> {
    let repo = SeaDashboardRepo::new(state.db.clone());
    let (inicio, fim) = intervalo_periodo(periodo.as_deref());
    let ind = dashboard::do_periodo(&inicio, &fim, &repo).await?;
    Ok(DashboardDto {
        vendas_centavos: ind.vendas_centavos,
        itens_vendidos: ind.itens_vendidos,
        ticket_medio_centavos: ind.ticket_medio_centavos,
        total_livros: ind.total_livros,
        total_estoque: ind.total_estoque,
        estoque_baixo: ind.estoque_baixo.into_iter().map(LivroDto::from).collect(),
        canceladas_qtd: ind.canceladas_qtd,
        canceladas_centavos: ind.canceladas_centavos,
    })
}
