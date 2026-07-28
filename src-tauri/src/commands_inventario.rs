//! Comandos Tauri do inventario legado. As rotinas oficiais de inventario foram
//! centralizadas no Escritorio/nuvem; o PDV preserva apenas venda, turno e consulta.

use crate::application::ports_inventario::{
    DivergenciaView, FechamentoView, PendenciaView, RelatorioView, SessaoView,
};
use crate::commands::{AppState, ErroDto, LivroDto};
use serde::Serialize;

fn rotina_nuvem<T>() -> Result<T, ErroDto> {
    Err(ErroDto {
        codigo: "ROTINA_NUVEM".to_string(),
        mensagem: "Inventario oficial fica no Escritorio/nuvem.".to_string(),
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BipagemDto {
    pub encontrado: bool,
    pub livro: Option<LivroDto>,
    pub qtd_contada: Option<i64>,
    pub pendencia: Option<PendenciaView>,
}

#[tauri::command]
pub async fn inventario_abrir(
    _state: tauri::State<'_, AppState>,
    _modo: String,
    _rotulo: Option<String>,
) -> Result<SessaoView, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn inventario_sessao_aberta(
    _state: tauri::State<'_, AppState>,
) -> Result<Option<SessaoView>, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn inventario_bipar(
    _state: tauri::State<'_, AppState>,
    _sessao_id: i64,
    _codigo_barras: String,
) -> Result<BipagemDto, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn inventario_desbipar(
    _state: tauri::State<'_, AppState>,
    _sessao_id: i64,
    _codigo_barras: String,
) -> Result<BipagemDto, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn inventario_ajustar_item(
    _state: tauri::State<'_, AppState>,
    _sessao_id: i64,
    _codigo: String,
    _qtd_contada: i64,
) -> Result<(), ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn inventario_revisao(
    _state: tauri::State<'_, AppState>,
    _sessao_id: i64,
) -> Result<Vec<DivergenciaView>, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn inventario_fechar(
    _state: tauri::State<'_, AppState>,
    _sessao_id: i64,
    _confirmar_total: Option<bool>,
) -> Result<FechamentoView, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn inventario_cancelar(
    _state: tauri::State<'_, AppState>,
    _sessao_id: i64,
) -> Result<(), ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn inventario_divergencias(
    _state: tauri::State<'_, AppState>,
    _sessao_id: i64,
) -> Result<Vec<DivergenciaView>, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn inventario_realizados(
    _state: tauri::State<'_, AppState>,
) -> Result<Vec<SessaoView>, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn inventario_relatorio(
    _state: tauri::State<'_, AppState>,
    _sessao_id: i64,
) -> Result<RelatorioView, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn inventario_pendencias(
    _state: tauri::State<'_, AppState>,
    _apenas_abertas: Option<bool>,
) -> Result<Vec<PendenciaView>, ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn resolver_pendencia(
    _state: tauri::State<'_, AppState>,
    _pendencia_id: i64,
) -> Result<(), ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn reabrir_pendencia(
    _state: tauri::State<'_, AppState>,
    _pendencia_id: i64,
) -> Result<(), ErroDto> {
    rotina_nuvem()
}

#[tauri::command]
pub async fn buscar_por_codigo_barras(
    _state: tauri::State<'_, AppState>,
    _codigo_barras: String,
) -> Result<Option<LivroDto>, ErroDto> {
    rotina_nuvem()
}
