//! Portas da feature 002 (razão de movimentos & inventário). Implementadas por
//! adapters SeaORM. Dependências apontam para dentro (ADR-0002).

use crate::application::ports::RepoErro;
use crate::domain::livro::Livro;
use async_trait::async_trait;
use serde::Serialize;

/// Comando de entrada de mercadoria (compra). O custo unitário já vem derivado
/// pelo caso de uso (FR-010a); o custo médio é recalculado dentro da transação.
pub struct EntradaCmd {
    pub livro_codigo: String,
    pub qtd: i64,
    pub custo_unit_centavos: i64,
    pub fornecedor: String,
}

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

/// Porta da razão de movimentos: entrada, ajuste, extrato, saldo inicial e
/// sugestões de fornecedor. Cada mutação é atômica (movimento + saldo) (ADR-0008).
#[async_trait]
pub trait EstoqueRepo: Send + Sync {
    /// Entrada (compra): insere movimento `entrada`, soma estoque e recalcula o
    /// custo médio ponderado, tudo na mesma transação. Retorna o livro atualizado.
    async fn registrar_entrada(&self, cmd: EntradaCmd) -> Result<Livro, RepoErro>;

    /// Ajuste avulso (±) com motivo: insere movimento `ajuste` e atualiza o estoque.
    /// O caso de uso já validou motivo e não-negativo (FR-040..043).
    async fn registrar_ajuste(
        &self,
        codigo: &str,
        delta: i64,
        motivo: &str,
    ) -> Result<Livro, RepoErro>;

    /// Extrato cronológico do livro com saldo resultante por linha (FR-050).
    async fn extrato(&self, codigo: &str, limite: i64) -> Result<Vec<MovimentoView>, RepoErro>;

    /// Gera `saldo_inicial` por livro sem movimento (idempotente, FR-006).
    /// Retorna quantos saldos iniciais foram criados.
    async fn gerar_saldos_iniciais(&self) -> Result<u64, RepoErro>;

    /// Fornecedores já usados que começam com `prefixo` (FR-012).
    async fn fornecedores_sugestoes(
        &self,
        prefixo: &str,
        limite: i64,
    ) -> Result<Vec<String>, RepoErro>;
}
