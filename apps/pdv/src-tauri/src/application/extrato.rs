//! Caso de uso: extrato de movimentação de um livro (US4, FR-050).

use crate::application::erros::ErroApp;
use crate::application::ports_estoque::{EstoqueRepo, MovimentoView};

/// Lista os movimentos do livro em ordem cronológica (mais recente primeiro),
/// com saldo resultante por linha. `limite` 0 = todos.
pub async fn extrato_livro(
    codigo: &str,
    limite: i64,
    estoque: &dyn EstoqueRepo,
) -> Result<Vec<MovimentoView>, ErroApp> {
    Ok(estoque.extrato(codigo, limite).await?)
}
