//! Comandos Tauri da razão de movimentos (US1/US3/US4). Separado de `commands.rs`
//! para respeitar o limite de 300 linhas (Princípio III).

use crate::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use crate::application::ports_estoque::MovimentoView;
use crate::application::extrato;
use crate::commands::{AppState, ErroDto};

fn rotina_nuvem<T>() -> Result<T, ErroDto> {
    Err(ErroDto {
        codigo: "ROTINA_NUVEM".to_string(),
        mensagem: "Ajustes oficiais de estoque ficam no Escritorio/nuvem.".to_string(),
    })
}

/// Registra um ajuste avulso de estoque com motivo (US3, FR-040..043).
#[tauri::command]
pub async fn registrar_ajuste(
    _state: tauri::State<'_, AppState>,
    _codigo: String,
    _qtd: i64,
    _motivo: String,
) -> Result<crate::commands::LivroDto, ErroDto> {
    rotina_nuvem()
}

/// Extrato de movimentação de um livro (US4, FR-050).
#[tauri::command]
pub async fn extrato_livro(
    state: tauri::State<'_, AppState>,
    codigo: String,
    limite: Option<i64>,
) -> Result<Vec<MovimentoView>, ErroDto> {
    let estoque = SeaEstoqueRepo::new(state.db.clone());
    Ok(extrato::extrato_livro(&codigo, limite.unwrap_or(0), &estoque).await?)
}
