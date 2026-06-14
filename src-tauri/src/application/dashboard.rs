//! Caso de uso: indicadores do dia (US4, FR-030/031).

use crate::application::erros::ErroApp;
use crate::application::ports::DashboardRepo;
use crate::domain::livro::Livro;

pub struct Indicadores {
    pub vendas_centavos: i64,
    pub itens_vendidos: i64,
    pub ticket_medio_centavos: i64,
    pub total_livros: i64,
    pub total_estoque: i64,
    pub estoque_baixo: Vec<Livro>,
}

/// Monta os indicadores do dia: vendas (Σ totais), itens, ticket médio e estoque baixo (≤3).
pub async fn do_dia(data: &str, repo: &dyn DashboardRepo) -> Result<Indicadores, ErroApp> {
    let r = repo.resumo_do_dia(data).await?;
    let ticket = if r.num_pedidos > 0 {
        r.total_centavos / r.num_pedidos
    } else {
        0
    };
    let estoque_baixo = repo.estoque_baixo(3).await?;
    let total_livros = repo.total_livros().await?;
    let total_estoque = repo.total_estoque().await?;
    Ok(Indicadores {
        vendas_centavos: r.total_centavos,
        itens_vendidos: r.itens_vendidos,
        ticket_medio_centavos: ticket,
        total_livros,
        total_estoque,
        estoque_baixo,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::ports::{RepoErro, ResumoDia};
    use async_trait::async_trait;

    struct FakeRepo;
    #[async_trait]
    impl DashboardRepo for FakeRepo {
        async fn resumo_do_dia(&self, _data: &str) -> Result<ResumoDia, RepoErro> {
            Ok(ResumoDia {
                total_centavos: 9000,
                num_pedidos: 3,
                itens_vendidos: 7,
            })
        }
        async fn estoque_baixo(&self, _l: i64) -> Result<Vec<Livro>, RepoErro> {
            Ok(vec![])
        }
        async fn total_livros(&self) -> Result<i64, RepoErro> {
            Ok(0)
        }
        async fn total_estoque(&self) -> Result<i64, RepoErro> {
            Ok(0)
        }
    }

    #[tokio::test]
    async fn ticket_medio_e_indicadores() {
        let ind = do_dia("2026-06-14", &FakeRepo).await.unwrap();
        assert_eq!(ind.vendas_centavos, 9000);
        assert_eq!(ind.itens_vendidos, 7);
        assert_eq!(ind.ticket_medio_centavos, 3000); // 9000 / 3
    }
}
