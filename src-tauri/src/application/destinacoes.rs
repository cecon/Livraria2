//! Leitura por destinação para o relatório (US2 — FR-016/FR-018). O cadastro de
//! destinações e a operação de destinar estoque vivem na nuvem (feature 012).

use crate::application::erros::ErroApp;
use crate::application::ports_destinacao::{DestinacaoRepo, RelatorioDestinacoes};

/// Relatório por destinação no período + posição atual (US2 — FR-016/FR-018).
pub async fn relatorio(
    inicio: &str,
    fim: &str,
    repo: &dyn DestinacaoRepo,
) -> Result<RelatorioDestinacoes, ErroApp> {
    Ok(repo.relatorio(inicio, fim).await?)
}
