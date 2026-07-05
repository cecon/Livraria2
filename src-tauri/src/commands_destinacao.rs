//! Comandos Tauri das destinações (ADR-0014): cadastro (US3), destinar estoque
//! (US1) e relatório por destinação (US2). DTOs em camelCase (contracts).

use crate::adapters::persistencia::destinacao_repo::SeaDestinacaoRepo;
use crate::application::destinacoes;
use crate::application::ports_destinacao::{RelatorioDestinacoes, SaldoLivro, TransferenciaReg};
use crate::commands::{AppState, ErroDto};
use crate::domain::destinacao::Destinacao;

fn repo(state: &tauri::State<'_, AppState>) -> SeaDestinacaoRepo {
    SeaDestinacaoRepo::new(state.db.clone())
}

/// Todas, por ordem (inclui inativas — tela de cadastro).
#[tauri::command]
pub async fn destinacoes_listar(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Destinacao>, ErroDto> {
    Ok(destinacoes::listar(&repo(&state)).await?)
}

/// Só ativas, por ordem (selects de transferência).
#[tauri::command]
pub async fn destinacoes_listar_ativas(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Destinacao>, ErroDto> {
    Ok(destinacoes::listar_ativas(&repo(&state)).await?)
}

#[tauri::command]
pub async fn destinacao_criar(
    state: tauri::State<'_, AppState>,
    nome: String,
) -> Result<Destinacao, ErroDto> {
    Ok(destinacoes::criar(&nome, &repo(&state)).await?)
}

#[tauri::command]
pub async fn destinacao_renomear(
    state: tauri::State<'_, AppState>,
    id: i64,
    nome: String,
) -> Result<Destinacao, ErroDto> {
    Ok(destinacoes::renomear(id, &nome, &repo(&state)).await?)
}

#[tauri::command]
pub async fn destinacao_definir_ativa(
    state: tauri::State<'_, AppState>,
    id: i64,
    ativa: bool,
) -> Result<Destinacao, ErroDto> {
    Ok(destinacoes::definir_ativa(id, ativa, &repo(&state)).await?)
}

/// Ids das destinações LIVRES na nova ordem; a Loja fica fixa no topo (FR-002).
#[tauri::command]
pub async fn destinacao_reordenar(
    state: tauri::State<'_, AppState>,
    ids: Vec<i64>,
) -> Result<Vec<Destinacao>, ErroDto> {
    Ok(destinacoes::reordenar(&ids, &repo(&state)).await?)
}

#[tauri::command]
pub async fn destinacao_excluir(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), ErroDto> {
    destinacoes::excluir(id, &repo(&state)).await?;
    Ok(())
}

/// Saldos do livro (livre + carimbos) para a tela "Destinar estoque" (US1).
#[tauri::command]
pub async fn destinacao_saldos_livro(
    state: tauri::State<'_, AppState>,
    codigo: String,
) -> Result<SaldoLivro, ErroDto> {
    Ok(destinacoes::saldos_livro(&codigo, &repo(&state)).await?)
}

/// Transfere quantidades entre livre e carimbos (`null` = livre) — FR-006.
#[tauri::command]
pub async fn destinacao_transferir(
    state: tauri::State<'_, AppState>,
    codigo: String,
    de_destinacao_id: Option<i64>,
    para_destinacao_id: Option<i64>,
    qtd: i64,
    motivo: Option<String>,
) -> Result<SaldoLivro, ErroDto> {
    Ok(destinacoes::transferir(
        &codigo,
        de_destinacao_id,
        para_destinacao_id,
        qtd,
        motivo,
        &repo(&state),
    )
    .await?)
}

/// Histórico de transferências do livro, mais recente primeiro (FR-007).
#[tauri::command]
pub async fn destinacao_transferencias_livro(
    state: tauri::State<'_, AppState>,
    codigo: String,
) -> Result<Vec<TransferenciaReg>, ErroDto> {
    Ok(destinacoes::historico(&codigo, &repo(&state)).await?)
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
