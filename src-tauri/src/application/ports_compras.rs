//! Portas da feature 003 (fornecedores & lançamento de notas). Implementadas por
//! adapters SeaORM. Dependências apontam para dentro (ADR-0002).

use crate::application::ports::RepoErro;
use crate::domain::fornecedor::Fornecedor;
use async_trait::async_trait;
use serde::Serialize;

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

/// Linha de uma nota (serializável p/ fronteira).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemNota {
    pub item_id: i64,
    pub codigo: String,
    pub titulo: String,
    pub qtd: i64,
    pub custo_unit_centavos: i64,
    pub subtotal_centavos: i64,
}

/// Resumo de nota para a lista de lançamentos.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LancamentoResumo {
    pub id: i64,
    pub fornecedor_nome: Option<String>,
    pub data: String,
    pub status: String,
    pub total_centavos: i64,
    pub qtd_itens: i64,
}

/// Página de lançamentos (lista + total para a paginação no banco).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginaLancamentos {
    pub itens: Vec<LancamentoResumo>,
    pub total: i64,
}

/// Detalhe de uma nota (cabeçalho + itens).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LancamentoDetalhe {
    pub id: i64,
    pub fornecedor_id: Option<i64>,
    pub fornecedor_nome: Option<String>,
    pub numero: Option<String>,
    pub data: String,
    pub status: String,
    pub total_centavos: i64,
    pub itens: Vec<ItemNota>,
}

/// Repositório de lançamentos/notas (US2/US3/US4).
#[async_trait]
pub trait LancamentoRepo: Send + Sync {
    async fn criar(&self, fornecedor_id: Option<i64>) -> Result<LancamentoDetalhe, RepoErro>;
    async fn obter(&self, id: i64) -> Result<Option<LancamentoDetalhe>, RepoErro>;
    /// Página de notas (mais recentes primeiro) — `LIMIT limite OFFSET offset` + total.
    async fn listar(&self, limite: i64, offset: i64) -> Result<PaginaLancamentos, RepoErro>;
    /// Define fornecedor e número (só rascunho).
    async fn definir_fornecedor(
        &self,
        id: i64,
        fornecedor_id: i64,
        numero: Option<String>,
    ) -> Result<(), RepoErro>;
    /// Adiciona um item; se o livro já está na nota, soma a qtd (UNIQUE). Custo já derivado.
    async fn adicionar_item(
        &self,
        id: i64,
        livro_codigo: &str,
        qtd: i64,
        custo_unit_centavos: i64,
    ) -> Result<LancamentoDetalhe, RepoErro>;
    async fn remover_item(&self, id: i64, item_id: i64) -> Result<LancamentoDetalhe, RepoErro>;
    /// Exclui a nota (só rascunho); não afeta estoque.
    async fn excluir(&self, id: i64) -> Result<(), RepoErro>;
    /// Status da nota (`rascunho`/`finalizada`/inexistente=None).
    async fn status(&self, id: i64) -> Result<Option<String>, RepoErro>;
    /// Finaliza (dá entrada) atomicamente: 1 movimento `entrada` por item, estoque e
    /// custo médio atualizados; marca `finalizada`. Idempotente.
    async fn finalizar(&self, id: i64) -> Result<LancamentoDetalhe, RepoErro>;
    /// Cancela uma nota FINALIZADA por **estorno** (contábil): gera um movimento
    /// `estorno` por item (reverte o estoque) e marca `cancelada`. Bloqueia se o estoque
    /// já foi consumido (evita negativo). Idempotente para nota já cancelada.
    async fn cancelar(&self, id: i64) -> Result<LancamentoDetalhe, RepoErro>;
}
