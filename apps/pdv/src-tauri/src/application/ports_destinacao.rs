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

/// Linha do relatório por destinação (contracts: RelatorioDestinacoes.linhas).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinhaRelatorio {
    pub destinacao_id: i64,
    pub nome: String,
    pub qtd: i64,
    pub valor_centavos: i64,
}

/// Posição atual dos carimbos (FR-018): Σ por destinação, todos os livros.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PosicaoAtual {
    pub destinacao_id: i64,
    pub nome: String,
    pub qtd: i64,
}

/// Relatório por período: especiais somadas das alocações; Loja derivada
/// (total − Σ demais), cobrindo livre + carimbo Loja (D3).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelatorioDestinacoes {
    pub inicio: String,
    pub fim: String,
    pub total_centavos: i64,
    pub linhas: Vec<LinhaRelatorio>,
    pub posicao_atual: Vec<PosicaoAtual>,
}

/// Livro dentro do repasse (relatório de vendas do dia — FR-016).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LivroRepasse {
    pub titulo: String,
    pub qtd: i64,
    pub valor_centavos: i64,
}

/// Repasse por destinação no relatório de vendas: livros vendidos + total —
/// é o valor a repassar no fechamento. Só destinações ESPECIAIS (a Loja não
/// entra: o dinheiro dela é da própria loja).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepasseDestinacao {
    pub destinacao_id: i64,
    pub nome: String,
    pub qtd: i64,
    pub valor_centavos: i64,
    pub livros: Vec<LivroRepasse>,
}

#[async_trait]
pub trait DestinacaoRepo: Send + Sync {
    // Feature 012 ("a nuvem manda"): o CADASTRO e a operação de DESTINAR estoque
    // (transferir carimbos) vivem na nuvem. O PDV só LÊ o que o relatório precisa.
    async fn listar(&self) -> Result<Vec<Destinacao>, RepoErro>;
    /// Datas ISO inclusivas. Só pedidos não cancelados (estorno retroativo — FR-010).
    async fn relatorio(&self, inicio: &str, fim: &str) -> Result<RelatorioDestinacoes, RepoErro>;
    /// Repasse do relatório de vendas: por destinação ESPECIAL, livros + total.
    /// `periodo` = dia|manha|tarde (mesmo filtro do relatório de vendas).
    async fn repasse(&self, data: &str, periodo: &str) -> Result<Vec<RepasseDestinacao>, RepoErro>;
}
