//! Comandos Tauri do inventário e pendências (US2/US5). Separado para respeitar
//! o limite de 300 linhas (Princípio III).

use crate::adapters::persistencia::inventario_repo::SeaInventarioRepo;
use crate::adapters::persistencia::livro_repo::SeaLivroRepo;
use crate::application::erros::ErroApp;
use crate::application::inventario;
use crate::application::ports_inventario::{
    DivergenciaView, FechamentoView, InventarioRepo, PendenciaView, SessaoView,
};
use crate::commands::{AppState, ErroDto, LivroDto};
use serde::Serialize;

fn repo(state: &tauri::State<'_, AppState>) -> SeaInventarioRepo {
    SeaInventarioRepo::new(state.db.clone())
}

/// Resultado de bipagem serializável (livro convertido para DTO de fronteira).
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
    state: tauri::State<'_, AppState>,
    modo: String,
    rotulo: Option<String>,
) -> Result<SessaoView, ErroDto> {
    Ok(inventario::abrir(&modo, rotulo, &repo(&state)).await?)
}

#[tauri::command]
pub async fn inventario_sessao_aberta(
    state: tauri::State<'_, AppState>,
) -> Result<Option<SessaoView>, ErroDto> {
    Ok(repo(&state).sessao_aberta().await.map_err(ErroApp::from)?)
}

#[tauri::command]
pub async fn inventario_bipar(
    state: tauri::State<'_, AppState>,
    sessao_id: i64,
    codigo_barras: String,
) -> Result<BipagemDto, ErroDto> {
    let r = repo(&state)
        .bipar(sessao_id, codigo_barras.trim())
        .await
        .map_err(ErroApp::from)?;
    Ok(BipagemDto {
        encontrado: r.livro.is_some(),
        livro: r.livro.map(LivroDto::from),
        qtd_contada: r.qtd_contada,
        pendencia: r.pendencia,
    })
}

#[tauri::command]
pub async fn inventario_ajustar_item(
    state: tauri::State<'_, AppState>,
    sessao_id: i64,
    codigo: String,
    qtd_contada: i64,
) -> Result<(), ErroDto> {
    repo(&state)
        .ajustar_item(sessao_id, &codigo, qtd_contada)
        .await
        .map_err(ErroApp::from)?;
    Ok(())
}

#[tauri::command]
pub async fn inventario_revisao(
    state: tauri::State<'_, AppState>,
    sessao_id: i64,
) -> Result<Vec<DivergenciaView>, ErroDto> {
    Ok(repo(&state).revisao(sessao_id).await.map_err(ErroApp::from)?)
}

#[tauri::command]
pub async fn inventario_fechar(
    state: tauri::State<'_, AppState>,
    sessao_id: i64,
    confirmar_total: Option<bool>,
) -> Result<FechamentoView, ErroDto> {
    Ok(repo(&state)
        .fechar(sessao_id, confirmar_total.unwrap_or(false))
        .await
        .map_err(ErroApp::from)?)
}

#[tauri::command]
pub async fn inventario_cancelar(
    state: tauri::State<'_, AppState>,
    sessao_id: i64,
) -> Result<(), ErroDto> {
    repo(&state).cancelar(sessao_id).await.map_err(ErroApp::from)?;
    Ok(())
}

#[tauri::command]
pub async fn inventario_divergencias(
    state: tauri::State<'_, AppState>,
    sessao_id: i64,
) -> Result<Vec<DivergenciaView>, ErroDto> {
    Ok(repo(&state)
        .divergencias(sessao_id)
        .await
        .map_err(ErroApp::from)?)
}

#[tauri::command]
pub async fn inventario_pendencias(
    state: tauri::State<'_, AppState>,
    apenas_abertas: Option<bool>,
) -> Result<Vec<PendenciaView>, ErroDto> {
    Ok(repo(&state)
        .pendencias(apenas_abertas.unwrap_or(true))
        .await
        .map_err(ErroApp::from)?)
}

#[tauri::command]
pub async fn resolver_pendencia(
    state: tauri::State<'_, AppState>,
    pendencia_id: i64,
) -> Result<(), ErroDto> {
    repo(&state)
        .resolver_pendencia(pendencia_id)
        .await
        .map_err(ErroApp::from)?;
    Ok(())
}

#[tauri::command]
pub async fn buscar_por_codigo_barras(
    state: tauri::State<'_, AppState>,
    codigo_barras: String,
) -> Result<Option<LivroDto>, ErroDto> {
    let livros = SeaLivroRepo::new(state.db.clone());
    let l = livros
        .por_codigo_barras_ou_codigo(codigo_barras.trim())
        .await
        .map_err(ErroApp::from)?;
    Ok(l.map(LivroDto::from))
}
