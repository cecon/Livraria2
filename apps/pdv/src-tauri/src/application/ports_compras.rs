//! Porta de fornecedores (feature 003). Feature 012 ("a nuvem manda"): o cadastro
//! de fornecedor vive na nuvem; o PDV só SEMEIA (boot) para o sync empurrar.

use crate::application::ports::RepoErro;
use async_trait::async_trait;

#[async_trait]
pub trait FornecedorRepo: Send + Sync {
    /// Semeia fornecedores a partir dos textos distintos de `movimento_estoque.fornecedor`
    /// (idempotente). Retorna quantos foram criados.
    async fn semear(&self) -> Result<u64, RepoErro>;
}
