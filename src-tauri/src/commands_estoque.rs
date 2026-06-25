//! Comandos Tauri da razão de movimentos (US1/US3/US4). Separado de `commands.rs`
//! para respeitar o limite de 300 linhas (Princípio III).

use crate::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use crate::application::ports_estoque::MovimentoView;
use crate::application::{ajuste, extrato};
use crate::commands::{AppState, ErroDto, LivroDto};

/// Registra um ajuste avulso de estoque com motivo (US3, FR-040..043).
#[tauri::command]
pub async fn registrar_ajuste(
    state: tauri::State<'_, AppState>,
    codigo: String,
    qtd: i64,
    motivo: String,
) -> Result<LivroDto, ErroDto> {
    let livros = crate::adapters::persistencia::livro_repo::SeaLivroRepo::new(state.db.clone());
    let estoque = SeaEstoqueRepo::new(state.db.clone());
    let livro = ajuste::registrar_ajuste(&codigo, qtd, &motivo, &livros, &estoque).await?;
    Ok(LivroDto::from(livro))
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
