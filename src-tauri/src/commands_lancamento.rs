//! Comandos Tauri de lancamentos/notas legados. As entradas oficiais de estoque
//! foram centralizadas no Escritorio/nuvem.

use crate::application::ports_compras::{LancamentoDetalhe, PaginaLancamentos};
use crate::commands::{AppState, ErroDto};

fn rotina_nuvem<T>() -> Result<T, ErroDto> {
    Err(ErroDto {
        codigo: "ROTINA_NUVEM".to_string(),
        mensagem: "Lancamentos oficiais de entrada ficam no Escritorio/nuvem.".to_string(),
    })
}

#[tauri::command]
pub async fn lancamentos_listar(
    _state: tauri::State<'_, AppState>,
    _pagina: Option<i64>,
    _por_pagina: Option<i64>,
) -> Result<PaginaLancamentos, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn lancamento_obter(
    _state: tauri::State<'_, AppState>,
    _id: i64,
) -> Result<Option<LancamentoDetalhe>, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn lancamento_criar(
    _state: tauri::State<'_, AppState>,
    _fornecedor_id: Option<i64>,
) -> Result<LancamentoDetalhe, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn lancamento_definir_fornecedor(
    _state: tauri::State<'_, AppState>,
    _id: i64,
    _fornecedor_id: i64,
    _numero: Option<String>,
) -> Result<(), ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn lancamento_adicionar_item(
    _state: tauri::State<'_, AppState>,
    _id: i64,
    _codigo: String,
    _qtd: i64,
    _custo_total_centavos: Option<i64>,
    _custo_unit_centavos: Option<i64>,
) -> Result<LancamentoDetalhe, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn lancamento_remover_item(
    _state: tauri::State<'_, AppState>,
    _id: i64,
    _item_id: i64,
) -> Result<LancamentoDetalhe, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn lancamento_excluir(
    _state: tauri::State<'_, AppState>,
    _id: i64,
) -> Result<(), ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn lancamento_finalizar(
    _state: tauri::State<'_, AppState>,
    _id: i64,
) -> Result<LancamentoDetalhe, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn lancamento_cancelar(
    _state: tauri::State<'_, AppState>,
    _id: i64,
) -> Result<LancamentoDetalhe, ErroDto> {
    rotina_nuvem()
}
