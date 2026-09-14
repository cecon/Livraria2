//! Adoção da razão de movimentos: garante um `saldo_inicial` (baseline) por livro
//! (FR-006, ADR-0017). Repara inclusive livros herdados do legado com movimentos mas
//! sem baseline (`Σ ≠ estoque`). Idempotente e roda no boot **antes** do sync — assim o
//! recompute (ADR-0016) nunca vê um ledger incompleto. Seguro re-executar.

use crate::application::erros::ErroApp;
use crate::application::ports_estoque::EstoqueRepo;

/// Garante o `saldo_inicial` de cada livro que ainda não o tem (baseline = `estoque − Σ`).
/// Retorna quantos baselines foram criados nesta execução.
pub async fn adotar(estoque: &dyn EstoqueRepo) -> Result<u64, ErroApp> {
    Ok(estoque.gerar_saldos_iniciais().await?)
}
