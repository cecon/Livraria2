//! Leitura do cadastro de formas de pagamento (US2). A EDIÇÃO de formas vive na
//! nuvem (feature 012 — "a nuvem manda"); o PDV só consulta as ativas para a venda.

use crate::application::erros::ErroApp;
use crate::application::ports::FormaPagamentoRepo;
use crate::domain::pagamento::FormaPagamento;

pub async fn listar_ativas(repo: &dyn FormaPagamentoRepo) -> Result<Vec<FormaPagamento>, ErroApp> {
    Ok(repo.listar_ativas().await?)
}
