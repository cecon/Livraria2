//! Portas da razão de movimentos de estoque. Implementadas por adapters SeaORM.
//! Dependências apontam para dentro (ADR-0002). Feature 012: entrada/ajuste são
//! contabilidade oficial e vivem na nuvem; o PDV só LÊ o extrato e repara baseline.

use crate::application::ports::RepoErro;
use async_trait::async_trait;
use serde::Serialize;

/// Linha do extrato de movimentação de um livro (FR-050), com saldo acumulado.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MovimentoView {
    pub id: i64,
    pub tipo: String,
    pub qtd: i64,
    pub saldo_resultante: i64,
    pub custo_unit_centavos: Option<i64>,
    pub fornecedor: Option<String>,
    pub motivo: Option<String>,
    pub referencia: Option<String>,
    pub criado_em: String,
}

/// Porta de LEITURA/reparo da razão de movimentos: extrato + baseline de saldo
/// inicial. Cada operação é atômica (movimento + saldo) (ADR-0008).
#[async_trait]
pub trait EstoqueRepo: Send + Sync {
    /// Extrato cronológico do livro com saldo resultante por linha (FR-050).
    async fn extrato(&self, codigo: &str, limite: i64) -> Result<Vec<MovimentoView>, RepoErro>;

    /// Gera/repara o `saldo_inicial` (baseline) de cada livro que ainda não o tem
    /// (idempotente, FR-006, ADR-0017): baseline = `estoque − Σ movimentos`, restaurando
    /// `Σ == estoque` sem mexer no estoque cacheado. Retorna quantos baselines foram criados.
    async fn gerar_saldos_iniciais(&self) -> Result<u64, RepoErro>;
}
