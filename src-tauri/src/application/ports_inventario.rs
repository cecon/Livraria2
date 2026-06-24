//! Porta do inventário (US2/US5, ADR-0010). Implementada por adapter SeaORM.

use crate::application::ports::RepoErro;
use crate::domain::livro::Livro;
use async_trait::async_trait;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessaoView {
    pub id: i64,
    pub modo: String,
    pub rotulo: Option<String>,
    pub status: String,
    pub aberta_em: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DivergenciaView {
    pub codigo: String,
    pub titulo: String,
    pub qtd_sistema: i64,
    pub qtd_contada: i64,
    pub diferenca: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendenciaView {
    pub id: i64,
    pub codigo_lido: String,
    pub qtd: i64,
    pub resolvida: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FechamentoView {
    pub sessao_id: i64,
    pub ajustados: Vec<DivergenciaView>,
    pub total_diferencas: i64,
    pub pendencias: Vec<PendenciaView>,
}

/// Resultado de uma bipagem: achou o livro (incrementa contagem) ou virou pendência.
pub struct BipagemResultado {
    pub livro: Option<Livro>,
    pub qtd_contada: Option<i64>,
    pub pendencia: Option<PendenciaView>,
}

#[async_trait]
pub trait InventarioRepo: Send + Sync {
    /// Sessão atualmente aberta (mono-estação), se houver.
    async fn sessao_aberta(&self) -> Result<Option<SessaoView>, RepoErro>;
    /// Abre uma nova sessão (o caso de uso garante que não há outra aberta).
    async fn abrir(&self, modo: &str, rotulo: Option<String>) -> Result<SessaoView, RepoErro>;
    /// Bipagem: casa por `codigo_barras` OU `codigo`; senão acumula pendência.
    async fn bipar(&self, sessao_id: i64, codigo_lido: &str) -> Result<BipagemResultado, RepoErro>;
    /// Ajuste manual da quantidade contada de um livro na sessão.
    async fn ajustar_item(&self, sessao_id: i64, codigo: &str, qtd: i64) -> Result<(), RepoErro>;
    /// Divergências ao vivo (sistema atual vs contado) antes do fechamento.
    async fn revisao(&self, sessao_id: i64) -> Result<Vec<DivergenciaView>, RepoErro>;
    /// Fecha a sessão aplicando ajustes (modo total exige `confirmar_total`).
    async fn fechar(
        &self,
        sessao_id: i64,
        confirmar_total: bool,
    ) -> Result<FechamentoView, RepoErro>;
    /// Cancela a sessão sem alterar estoque.
    async fn cancelar(&self, sessao_id: i64) -> Result<(), RepoErro>;
    /// Divergências de uma sessão já fechada (reconstruídas do snapshot, FR-029).
    async fn divergencias(&self, sessao_id: i64) -> Result<Vec<DivergenciaView>, RepoErro>;
    /// Pendências de cadastro (US5). `apenas_abertas` filtra as não resolvidas.
    async fn pendencias(&self, apenas_abertas: bool) -> Result<Vec<PendenciaView>, RepoErro>;
    /// Marca uma pendência como resolvida (ao cadastrar o livro).
    async fn resolver_pendencia(&self, pendencia_id: i64) -> Result<(), RepoErro>;
}
