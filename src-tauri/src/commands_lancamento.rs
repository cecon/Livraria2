//! Comandos Tauri de lançamentos/notas (US2/US3/US4). DTOs de visão vêm de
//! `ports_compras` (já serializáveis em camelCase).

use crate::adapters::persistencia::lancamento_repo::SeaLancamentoRepo;
use crate::adapters::persistencia::livro_repo::SeaLivroRepo;
use crate::application::erros::ErroApp;
use crate::application::lancamentos;
use crate::application::ports_compras::{LancamentoDetalhe, PaginaLancamentos};
use crate::commands::{AppState, ErroDto};
use crate::domain::erros::ErroDominio;

fn repo(state: &tauri::State<'_, AppState>) -> SeaLancamentoRepo {
    SeaLancamentoRepo::new(state.db.clone())
}

#[tauri::command]
pub async fn lancamentos_listar(
    state: tauri::State<'_, AppState>,
    pagina: Option<i64>,
    por_pagina: Option<i64>,
) -> Result<PaginaLancamentos, ErroDto> {
    let pp = por_pagina.unwrap_or(12).max(1);
    let offset = (pagina.unwrap_or(1).max(1) - 1) * pp;
    Ok(lancamentos::listar(pp, offset, &repo(&state)).await?)
}

#[tauri::command]
pub async fn lancamento_obter(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<Option<LancamentoDetalhe>, ErroDto> {
    Ok(lancamentos::obter(id, &repo(&state)).await?)
}

#[tauri::command]
pub async fn lancamento_criar(
    state: tauri::State<'_, AppState>,
    fornecedor_id: Option<i64>,
) -> Result<LancamentoDetalhe, ErroDto> {
    Ok(lancamentos::criar(fornecedor_id, &repo(&state)).await?)
}

#[tauri::command]
pub async fn lancamento_definir_fornecedor(
    state: tauri::State<'_, AppState>,
    id: i64,
    fornecedor_id: i64,
    numero: Option<String>,
) -> Result<(), ErroDto> {
    lancamentos::definir_fornecedor(id, fornecedor_id, numero, &repo(&state)).await?;
    Ok(())
}

#[tauri::command]
pub async fn lancamento_adicionar_item(
    state: tauri::State<'_, AppState>,
    id: i64,
    codigo: String,
    qtd: i64,
    custo_total_centavos: Option<i64>,
    custo_unit_centavos: Option<i64>,
) -> Result<LancamentoDetalhe, ErroDto> {
    // Resolve o livro por código de barras OU código interno (FR-022/002).
    let livros = SeaLivroRepo::new(state.db.clone());
    let livro = livros
        .por_codigo_barras_ou_codigo(codigo.trim())
        .await
        .map_err(ErroApp::from)?
        .ok_or(ErroApp::Dominio(ErroDominio::LivroNaoEncontrado))?;
    Ok(lancamentos::adicionar_item(
        id,
        &livro.codigo,
        qtd,
        custo_total_centavos,
        custo_unit_centavos,
        &repo(&state),
    )
    .await?)
}

#[tauri::command]
pub async fn lancamento_remover_item(
    state: tauri::State<'_, AppState>,
    id: i64,
    item_id: i64,
) -> Result<LancamentoDetalhe, ErroDto> {
    Ok(lancamentos::remover_item(id, item_id, &repo(&state)).await?)
}

#[tauri::command]
pub async fn lancamento_excluir(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), ErroDto> {
    lancamentos::excluir(id, &repo(&state)).await?;
    Ok(())
}

#[tauri::command]
pub async fn lancamento_finalizar(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<LancamentoDetalhe, ErroDto> {
    Ok(lancamentos::finalizar(id, &repo(&state)).await?)
}

/// Cancela (estorna) uma nota finalizada — reverte o estoque.
#[tauri::command]
pub async fn lancamento_cancelar(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<LancamentoDetalhe, ErroDto> {
    Ok(lancamentos::cancelar(id, &repo(&state)).await?)
}
