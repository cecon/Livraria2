//! Comandos Tauri das destinações (ADR-0014): cadastro (US3), destinar estoque
//! (US1) e relatório por destinação (US2). DTOs em camelCase (contracts).

use crate::adapters::persistencia::destinacao_repo::SeaDestinacaoRepo;
use crate::application::destinacoes;
use crate::application::ports_destinacao::RelatorioDestinacoes;
use crate::commands::{AppState, ErroDto};

fn repo(state: &tauri::State<'_, AppState>) -> SeaDestinacaoRepo {
    SeaDestinacaoRepo::new(state.db.clone())
}











/// Relatório por destinação (datas ISO inclusivas) + posição atual (US2).
#[tauri::command]
pub async fn relatorio_destinacoes(
    state: tauri::State<'_, AppState>,
    inicio: String,
    fim: String,
) -> Result<RelatorioDestinacoes, ErroDto> {
    Ok(destinacoes::relatorio(&inicio, &fim, &repo(&state)).await?)
}
