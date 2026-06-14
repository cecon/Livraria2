//! Portas da arquitetura hexagonal (ADR-0002): interfaces que o domínio/aplicação
//! exigem e os adapters (SeaORM, mdbtools, relógio) implementam. Dependências apontam
//! para dentro — o domínio NUNCA conhece o adapter.

use crate::domain::livro::Livro;
use crate::domain::pedido::Pedido;
use async_trait::async_trait;

/// Erro de infraestrutura (persistência/adapter). Distinto de ErroDominio.
#[derive(Debug, thiserror::Error)]
pub enum RepoErro {
    #[error("erro de persistência: {0}")]
    Persistencia(String),
}

/// Repositório de livros (acervo). Implementado pelo adapter SeaORM.
#[async_trait]
pub trait LivroRepo: Send + Sync {
    async fn por_codigo(&self, codigo: &str) -> Result<Option<Livro>, RepoErro>;
    /// Upsert por código de barras (FR-002).
    async fn salvar(&self, livro: &Livro) -> Result<(), RepoErro>;
    /// Soft-delete: inativa o livro, preservando histórico (FR-001).
    async fn inativar(&self, codigo: &str) -> Result<(), RepoErro>;
    async fn recentes(&self, limite: i64) -> Result<Vec<Livro>, RepoErro>;
    async fn buscar_texto(&self, termo_norm: &str, limite: i64) -> Result<Vec<Livro>, RepoErro>;
}

/// Repositório de pedidos (vendas).
#[async_trait]
pub trait PedidoRepo: Send + Sync {
    /// Próximo número sequencial (MAX(numero)+1), contínuo entre execuções (FR-017).
    async fn proximo_numero(&self) -> Result<i64, RepoErro>;
    /// Grava pedido + itens e baixa o estoque, atomicamente (FR-015).
    async fn registrar(&self, pedido: &Pedido) -> Result<(), RepoErro>;
}

/// Relógio do sistema (porta) — permite testar turno/data sem depender do relógio real.
pub trait Relogio: Send + Sync {
    /// Hora local 0–23 (define o turno, FR-015).
    fn hora_atual(&self) -> u32;
    /// Data de hoje em ISO yyyy-mm-dd.
    fn hoje_iso(&self) -> String;
}
