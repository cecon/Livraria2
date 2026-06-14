//! Portas da arquitetura hexagonal (ADR-0002): interfaces que o domínio/aplicação
//! exigem e os adapters (SeaORM, mdbtools, relógio) implementam. Dependências apontam
//! para dentro — o domínio NUNCA conhece o adapter.

use crate::domain::livro::Livro;
use crate::domain::pedido::Pedido;
use async_trait::async_trait;
use serde::Serialize;

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
    /// Importa um pedido histórico de forma idempotente, SEM baixar estoque.
    /// Retorna `true` se inseriu, `false` se o número já existia (FR-069).
    async fn importar(&self, pedido: &Pedido) -> Result<bool, RepoErro>;
    /// Remove um item de pedido e recalcula o total do pedido (correção de dados).
    async fn excluir_item(&self, item_id: i64) -> Result<(), RepoErro>;
    /// Remove um pedido inteiro e seus itens (cancelar venda do dia).
    async fn excluir_pedido(&self, numero: i64) -> Result<(), RepoErro>;
}

/// Pedidos reconstruídos do legado + divergências encontradas (FR-067a).
pub struct PedidosImportados {
    pub pedidos: Vec<Pedido>,
    pub divergencias: Vec<String>,
}

/// Porta do importador do legado (Access). Implementada pelo adapter mdbtools.
pub trait ImportadorLegado: Send + Sync {
    fn livros(&self) -> Result<Vec<Livro>, RepoErro>;
    fn pedidos(&self) -> Result<PedidosImportados, RepoErro>;
}

/// Resumo agregado das vendas de um dia (dashboard).
pub struct ResumoDia {
    pub total_centavos: i64,
    pub num_pedidos: i64,
    pub itens_vendidos: i64,
}

/// Porta de leitura para o dashboard (US4).
#[async_trait]
pub trait DashboardRepo: Send + Sync {
    async fn resumo_do_dia(&self, data: &str) -> Result<ResumoDia, RepoErro>;
    async fn estoque_baixo(&self, limite: i64) -> Result<Vec<Livro>, RepoErro>;
    /// Total de livros ativos no acervo (nº de títulos).
    async fn total_livros(&self) -> Result<i64, RepoErro>;
    /// Soma das unidades em estoque (todos os livros ativos).
    async fn total_estoque(&self) -> Result<i64, RepoErro>;
}

/// Linha de item num relatório de vendas.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemRelatorio {
    pub id: i64,
    pub titulo: String,
    pub qtd: i64,
    pub valor_centavos: i64,
}

/// Pedido detalhado num relatório de vendas (itens + valores por forma).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PedidoRelatorio {
    pub numero: i64,
    pub cliente: String,
    pub itens: Vec<ItemRelatorio>,
    pub cartao: i64,
    pub dinheiro: i64,
    pub pix: i64,
    pub ministerio: i64,
    pub vale: i64,
    pub total_centavos: i64,
}

/// Porta de leitura para relatórios (US5).
#[async_trait]
pub trait RelatorioRepo: Send + Sync {
    /// Pedidos do período: `periodo` = "dia" | "manha" | "tarde".
    async fn vendas(&self, data: &str, periodo: &str) -> Result<Vec<PedidoRelatorio>, RepoErro>;
    /// Todos os livros ativos, ordenados por estoque crescente (FR-043).
    async fn estoque_completo(&self) -> Result<Vec<Livro>, RepoErro>;
}

/// Porta de autenticação simples (US5, gate de relatórios).
#[async_trait]
pub trait UsuarioRepo: Send + Sync {
    async fn autenticar(&self, usuario: &str, senha: &str) -> Result<bool, RepoErro>;
    /// Garante um admin padrão (adm/adm) se a tabela estiver vazia.
    async fn garantir_admin(&self) -> Result<(), RepoErro>;
}

/// Relógio do sistema (porta) — permite testar turno/data sem depender do relógio real.
pub trait Relogio: Send + Sync {
    /// Hora local 0–23 (define o turno, FR-015).
    fn hora_atual(&self) -> u32;
    /// Data de hoje em ISO yyyy-mm-dd.
    fn hoje_iso(&self) -> String;
}
