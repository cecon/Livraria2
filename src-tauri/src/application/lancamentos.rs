//! Casos de uso de lançamentos de nota (US2/US3/US4). Orquestra o LancamentoRepo
//! e o domínio (`pode_finalizar`, `derivar_custos`).

use crate::application::erros::ErroApp;
use crate::application::ports_compras::{LancamentoDetalhe, LancamentoRepo, PaginaLancamentos};
use crate::domain::erros::ErroDominio;
use crate::domain::estoque::derivar_custos;
use crate::domain::lancamento::{pode_finalizar, StatusLancamento};

pub async fn criar(
    fornecedor_id: Option<i64>,
    repo: &dyn LancamentoRepo,
) -> Result<LancamentoDetalhe, ErroApp> {
    Ok(repo.criar(fornecedor_id).await?)
}

pub async fn obter(id: i64, repo: &dyn LancamentoRepo) -> Result<Option<LancamentoDetalhe>, ErroApp> {
    Ok(repo.obter(id).await?)
}

pub async fn listar(
    limite: i64,
    offset: i64,
    repo: &dyn LancamentoRepo,
) -> Result<PaginaLancamentos, ErroApp> {
    Ok(repo.listar(limite, offset).await?)
}

/// Garante que a nota está em rascunho (editar finalizada → NOTA_FINALIZADA).
async fn exige_rascunho(id: i64, repo: &dyn LancamentoRepo) -> Result<(), ErroApp> {
    if repo.status(id).await?.as_deref() == Some("finalizada") {
        return Err(ErroDominio::NotaFinalizada.into());
    }
    Ok(())
}

pub async fn definir_fornecedor(
    id: i64,
    fornecedor_id: i64,
    numero: Option<String>,
    repo: &dyn LancamentoRepo,
) -> Result<(), ErroApp> {
    exige_rascunho(id, repo).await?;
    repo.definir_fornecedor(id, fornecedor_id, numero).await?;
    Ok(())
}

/// Adiciona um item: deriva o custo (total↔unitário) e soma na nota (UNIQUE).
pub async fn adicionar_item(
    id: i64,
    livro_codigo: &str,
    qtd: i64,
    custo_total: Option<i64>,
    custo_unit: Option<i64>,
    repo: &dyn LancamentoRepo,
) -> Result<LancamentoDetalhe, ErroApp> {
    exige_rascunho(id, repo).await?;
    let (unit, _total) = derivar_custos(custo_total, custo_unit, qtd)?;
    Ok(repo.adicionar_item(id, livro_codigo, qtd, unit).await?)
}

pub async fn remover_item(
    id: i64,
    item_id: i64,
    repo: &dyn LancamentoRepo,
) -> Result<LancamentoDetalhe, ErroApp> {
    exige_rascunho(id, repo).await?;
    Ok(repo.remover_item(id, item_id).await?)
}

pub async fn excluir(id: i64, repo: &dyn LancamentoRepo) -> Result<(), ErroApp> {
    repo.excluir(id).await?;
    Ok(())
}

/// Finaliza (dá entrada). Valida fornecedor + ≥1 item; idempotente (já finalizada → no-op).
pub async fn finalizar(id: i64, repo: &dyn LancamentoRepo) -> Result<LancamentoDetalhe, ErroApp> {
    let nota = repo
        .obter(id)
        .await?
        .ok_or(ErroDominio::DadosInvalidos("nota não encontrada".into()))?;
    if nota.status != "rascunho" {
        return Ok(nota); // idempotente (finalizada/cancelada não reaplicam)
    }
    pode_finalizar(StatusLancamento::Rascunho, nota.fornecedor_id.is_some(), nota.itens.len())?;
    Ok(repo.finalizar(id).await?)
}

/// Cancela uma nota finalizada por estorno (reverte o estoque). Idempotente.
pub async fn cancelar(id: i64, repo: &dyn LancamentoRepo) -> Result<LancamentoDetalhe, ErroApp> {
    Ok(repo.cancelar(id).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::ports::RepoErro;
    use crate::application::ports_compras::ItemNota;

    struct FakeLanc {
        fornecedor_id: Option<i64>,
        num_itens: usize,
        status: &'static str,
    }

    fn detalhe(f: &FakeLanc) -> LancamentoDetalhe {
        LancamentoDetalhe {
            id: 1,
            fornecedor_id: f.fornecedor_id,
            fornecedor_nome: None,
            numero: None,
            data: "2026-06-24".into(),
            status: f.status.into(),
            total_centavos: 0,
            itens: (0..f.num_itens)
                .map(|i| ItemNota {
                    item_id: i as i64,
                    codigo: "111".into(),
                    titulo: "L".into(),
                    qtd: 1,
                    custo_unit_centavos: 100,
                    subtotal_centavos: 100,
                })
                .collect(),
        }
    }

    #[async_trait::async_trait]
    impl LancamentoRepo for FakeLanc {
        async fn criar(&self, _f: Option<i64>) -> Result<LancamentoDetalhe, RepoErro> {
            Ok(detalhe(self))
        }
        async fn obter(&self, _id: i64) -> Result<Option<LancamentoDetalhe>, RepoErro> {
            Ok(Some(detalhe(self)))
        }
        async fn listar(&self, _l: i64, _o: i64) -> Result<PaginaLancamentos, RepoErro> {
            Ok(PaginaLancamentos { itens: vec![], total: 0 })
        }
        async fn definir_fornecedor(&self, _i: i64, _f: i64, _n: Option<String>) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn adicionar_item(&self, _i: i64, _c: &str, _q: i64, _u: i64) -> Result<LancamentoDetalhe, RepoErro> {
            Ok(detalhe(self))
        }
        async fn remover_item(&self, _i: i64, _it: i64) -> Result<LancamentoDetalhe, RepoErro> {
            Ok(detalhe(self))
        }
        async fn excluir(&self, _id: i64) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn status(&self, _id: i64) -> Result<Option<String>, RepoErro> {
            Ok(Some(self.status.into()))
        }
        async fn finalizar(&self, _id: i64) -> Result<LancamentoDetalhe, RepoErro> {
            Ok(LancamentoDetalhe { status: "finalizada".into(), ..detalhe(self) })
        }
        async fn cancelar(&self, _id: i64) -> Result<LancamentoDetalhe, RepoErro> {
            Ok(LancamentoDetalhe { status: "cancelada".into(), ..detalhe(self) })
        }
    }

    #[tokio::test]
    async fn finalizar_sem_fornecedor() {
        let fake = FakeLanc { fornecedor_id: None, num_itens: 2, status: "rascunho" };
        assert!(matches!(
            finalizar(1, &fake).await,
            Err(ErroApp::Dominio(ErroDominio::SemFornecedor))
        ));
    }

    #[tokio::test]
    async fn finalizar_sem_itens() {
        let fake = FakeLanc { fornecedor_id: Some(1), num_itens: 0, status: "rascunho" };
        assert!(matches!(
            finalizar(1, &fake).await,
            Err(ErroApp::Dominio(ErroDominio::SemItens))
        ));
    }

    #[tokio::test]
    async fn finalizar_ok_e_idempotente() {
        let ok = FakeLanc { fornecedor_id: Some(1), num_itens: 2, status: "rascunho" };
        assert_eq!(finalizar(1, &ok).await.unwrap().status, "finalizada");
        // já finalizada → no-op (não erra)
        let fin = FakeLanc { fornecedor_id: Some(1), num_itens: 2, status: "finalizada" };
        assert_eq!(finalizar(1, &fin).await.unwrap().status, "finalizada");
    }

    #[tokio::test]
    async fn editar_finalizada_barra() {
        let fin = FakeLanc { fornecedor_id: Some(1), num_itens: 1, status: "finalizada" };
        assert!(matches!(
            adicionar_item(1, "111", 1, None, Some(100), &fin).await,
            Err(ErroApp::Dominio(ErroDominio::NotaFinalizada))
        ));
    }
}
