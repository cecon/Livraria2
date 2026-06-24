//! Comandos Tauri da razão de movimentos (US1/US3/US4). Separado de `commands.rs`
//! para respeitar o limite de 300 linhas (Princípio III).

use crate::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use crate::application::entrada::{self, EntradaInput};
use crate::application::erros::ErroApp;
use crate::application::ports_estoque::{EstoqueRepo, MovimentoView};
use crate::application::{ajuste, extrato};
use crate::commands::{AppState, ErroDto, LivroDto};

/// Registra uma entrada de mercadoria (compra) — US1, FR-010..015.
#[tauri::command]
pub async fn registrar_entrada(
    state: tauri::State<'_, AppState>,
    input: EntradaInput,
) -> Result<LivroDto, ErroDto> {
    let estoque = SeaEstoqueRepo::new(state.db.clone());
    let livro = entrada::registrar_entrada(input, &estoque).await?;
    Ok(LivroDto::from(livro))
}

/// Sugere fornecedores já usados que começam com `prefixo` (US1, FR-012).
#[tauri::command]
pub async fn fornecedores_sugestoes(
    state: tauri::State<'_, AppState>,
    prefixo: Option<String>,
) -> Result<Vec<String>, ErroDto> {
    let estoque = SeaEstoqueRepo::new(state.db.clone());
    Ok(estoque
        .fornecedores_sugestoes(prefixo.as_deref().unwrap_or(""), 10)
        .await
        .map_err(ErroApp::from)?)
}

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
