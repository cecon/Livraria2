//! Caso de uso de fornecedores (US1). Feature 012: o cadastro vive na nuvem;
//! o PDV só ADOTA (boot) os fornecedores dos textos históricos da 002.

use crate::application::erros::ErroApp;
use crate::application::ports_compras::FornecedorRepo;

/// Adoção (boot): semeia fornecedores dos textos da 002 (idempotente, FR-005).
pub async fn adotar(repo: &dyn FornecedorRepo) -> Result<u64, ErroApp> {
    Ok(repo.semear().await?)
}
