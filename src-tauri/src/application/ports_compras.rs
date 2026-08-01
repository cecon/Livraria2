//! Porta de fornecedores (feature 003). O lançamento de notas saiu do PDV
//! (feature 012 — a entrada vive na nuvem). Implementada por adapter SeaORM.

use crate::application::ports::RepoErro;
use crate::domain::fornecedor::Fornecedor;
use async_trait::async_trait;

/// Repositório de fornecedores (US1).
#[async_trait]
pub trait FornecedorRepo: Send + Sync {
    /// Lista fornecedores ativos; filtra por nome quando `termo` não vazio.
    async fn listar(&self, termo: &str) -> Result<Vec<Fornecedor>, RepoErro>;
    async fn por_id(&self, id: i64) -> Result<Option<Fornecedor>, RepoErro>;
    /// Existe outro fornecedor com esse `nome_norm` (≠ `exceto_id`)? (FR-004)
    async fn existe_nome(&self, nome_norm: &str, exceto_id: i64) -> Result<bool, RepoErro>;
    /// Insere (id == 0) ou atualiza; retorna o fornecedor salvo (com id).
    async fn salvar(&self, f: &Fornecedor) -> Result<Fornecedor, RepoErro>;
    /// Soft-delete (ativo = 0), preservando notas que o referenciam.
    async fn excluir(&self, id: i64) -> Result<(), RepoErro>;
    /// Semeia fornecedores a partir dos textos distintos de `movimento_estoque.fornecedor`
    /// (idempotente). Retorna quantos foram criados.
    async fn semear(&self) -> Result<u64, RepoErro>;
}
