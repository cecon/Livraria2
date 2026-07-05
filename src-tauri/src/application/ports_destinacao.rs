//! Porta do cadastro/saldos de destinações (ADR-0014). O adapter SeaORM implementa;
//! a aplicação orquestra com as regras puras de `domain::destinacao`/`domain::alocacao`.

use crate::application::ports::RepoErro;
use crate::domain::destinacao::Destinacao;
use async_trait::async_trait;
use serde::Serialize;

/// Saldos de um livro para a tela de transferência (contracts: SaldoLivro).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaldoLivro {
    pub estoque: i64,
    /// Resíduo: `estoque − Σ carimbos` — pertence à Loja por definição (D1).
    pub livre: i64,
    pub carimbos: Vec<CarimboSaldo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CarimboSaldo {
    pub destinacao_id: i64,
    pub nome: String,
    pub qtd: i64,
}

/// Registro do histórico de transferências (contracts: Transferencia).
/// `de`/`para` já resolvidos para nome; `None` = saldo livre ("Livre" na UI).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferenciaReg {
    pub id: i64,
    pub de: Option<String>,
    pub para: Option<String>,
    pub qtd: i64,
    pub motivo: Option<String>,
    pub criado_em: String,
}

#[async_trait]
pub trait DestinacaoRepo: Send + Sync {
    // --- cadastro (US3) ---
    async fn listar(&self) -> Result<Vec<Destinacao>, RepoErro>;
    async fn listar_ativas(&self) -> Result<Vec<Destinacao>, RepoErro>;
    async fn por_id(&self, id: i64) -> Result<Option<Destinacao>, RepoErro>;
    /// Usada em saldo (qtd>0), alocação de venda ou transferência (FR-004/FR-007).
    async fn em_uso(&self, id: i64) -> Result<bool, RepoErro>;
    async fn criar(&self, nome: &str, nome_norm: &str, ordem: i64) -> Result<Destinacao, RepoErro>;
    async fn renomear(&self, id: i64, nome: &str, nome_norm: &str) -> Result<(), RepoErro>;
    async fn definir_ativa(&self, id: i64, ativa: bool) -> Result<(), RepoErro>;
    /// Nova ordem das destinações livres; a Loja permanece em 0 (FR-002).
    async fn reordenar(&self, ids: &[i64]) -> Result<(), RepoErro>;
    async fn excluir(&self, id: i64) -> Result<(), RepoErro>;

    // --- destinar estoque (US1) ---
    async fn saldos_livro(&self, livro_codigo: &str) -> Result<SaldoLivro, RepoErro>;
    /// Move carimbo atomicamente (upsert saldos + registro). Guards de negócio
    /// ficam no caso de uso; aqui só a mecânica transacional.
    async fn transferir(
        &self,
        livro_codigo: &str,
        de: Option<i64>,
        para: Option<i64>,
        qtd: i64,
        motivo: Option<String>,
    ) -> Result<SaldoLivro, RepoErro>;
    async fn transferencias_livro(
        &self,
        livro_codigo: &str,
    ) -> Result<Vec<TransferenciaReg>, RepoErro>;
}
