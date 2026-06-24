//! Adoção da razão de movimentos: gera o `saldo_inicial` por livro (FR-006).
//! Idempotente — chamado no boot, seguro re-executar.

use crate::application::erros::ErroApp;
use crate::application::ports_estoque::EstoqueRepo;

/// Garante um movimento `saldo_inicial` para cada livro que ainda não tem movimento.
/// Retorna quantos saldos iniciais foram criados nesta execução.
pub async fn adotar(estoque: &dyn EstoqueRepo) -> Result<u64, ErroApp> {
    Ok(estoque.gerar_saldos_iniciais().await?)
}
