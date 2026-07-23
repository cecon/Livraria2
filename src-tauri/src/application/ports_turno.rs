//! Portas do turno de operação (feature 009, ADR-0021). O adapter SeaORM persiste
//! em `turno_operacao` (m009), que sincroniza com a nuvem (replica_mapa).

use crate::application::ports::RepoErro;
use crate::domain::pedido::Recebimento;
use async_trait::async_trait;

/// Turno aberto (dados mínimos para a UI e para a numeração/fechamento).
#[derive(Clone)]
pub struct TurnoAbertoInfo {
    pub sync_uid: String,
    pub caixa_inicial_centavos: i64,
    pub abertura: String,
}

/// Dados do turno necessários ao fechamento de caixa.
pub struct DadosFechamento {
    pub caixa_inicial_centavos: i64,
    pub pagamentos: Vec<Recebimento>,
    pub qtd_vendas: i64,
}

/// Linha do histórico de turnos encerrados.
pub struct TurnoHistorico {
    pub abertura: String,
    pub encerramento: Option<String>,
    pub status: String,
    pub esperado_centavos: Option<i64>,
    pub conferido_centavos: Option<i64>,
    pub diferenca_centavos: Option<i64>,
}

#[async_trait]
pub trait TurnoRepo: Send + Sync {
    /// Turno `aberto` do operador nesta origem (ou `None`).
    async fn turno_aberto(&self, operador: &str) -> Result<Option<TurnoAbertoInfo>, RepoErro>;
    /// Abre um turno (gera `sync_uid`). Idempotência é do chamador (checa antes).
    async fn abrir(&self, operador: &str, caixa_inicial_centavos: i64) -> Result<TurnoAbertoInfo, RepoErro>;
    /// Pedidos não cancelados já registrados no turno (base do Pedido Nº).
    async fn contar_pedidos(&self, turno_uid: &str) -> Result<i64, RepoErro>;
    /// Caixa inicial + recebimentos + nº de vendas do turno (para o fechamento).
    async fn dados_fechamento(&self, turno_uid: &str) -> Result<DadosFechamento, RepoErro>;
    /// Id da forma de sistema "Dinheiro" (para o esperado só-dinheiro).
    async fn dinheiro_forma_id(&self) -> Result<i64, RepoErro>;
    /// Persiste o fechamento e marca o turno como encerrado.
    async fn encerrar(&self, turno_uid: &str, esperado: i64, conferido: i64, diferenca: i64) -> Result<(), RepoErro>;
    /// Histórico de turnos do operador (recentes primeiro).
    async fn listar(&self, operador: &str) -> Result<Vec<TurnoHistorico>, RepoErro>;
}
