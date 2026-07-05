//! Casos de uso: relatórios de vendas/estoque e autenticação (US5, FR-040..044).

use crate::application::erros::ErroApp;
use crate::application::ports::{FormaPagamentoRepo, PedidoRelatorio, RelatorioRepo, UsuarioRepo};
use serde::Serialize;

/// Total recebido numa forma do cadastro (relatórios dinâmicos — FR-019).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TotalForma {
    pub forma_id: i64,
    pub rotulo: String,
    pub total_centavos: i64,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResumoVendas {
    /// Uma entrada por forma do cadastro, na `ordem` (inclui zeros — FR-019).
    pub formas: Vec<TotalForma>,
    /// Total recebido: soma de TODAS as formas de pagamento (FR-042).
    pub subtotal_centavos: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelatorioVendas {
    pub periodo: String,
    pub data: String,
    pub pedidos: Vec<PedidoRelatorio>,
    pub resumo: ResumoVendas,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemEstoque {
    pub codigo: String,
    pub titulo: String,
    pub categoria: i64,
    pub preco_centavos: i64,
    pub estoque: i64,
    pub valor_centavos: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelatorioEstoque {
    pub titulos: i64,
    pub valor_total_centavos: i64,
    pub itens: Vec<ItemEstoque>,
}

pub async fn autenticar(
    usuario: &str,
    senha: &str,
    repo: &dyn UsuarioRepo,
) -> Result<bool, ErroApp> {
    Ok(repo.autenticar(usuario, senha).await?)
}

pub async fn vendas(
    data: &str,
    periodo: &str,
    repo: &dyn RelatorioRepo,
    formas: &dyn FormaPagamentoRepo,
) -> Result<RelatorioVendas, ErroApp> {
    let pedidos = repo.vendas(data, periodo).await?;
    // Uma entrada por forma do cadastro (na ordem), somando os recebimentos dos
    // pedidos não cancelados. Formas históricas desativadas continuam somando
    // porque também estão no cadastro (só somem das opções do PDV).
    let mut totais: Vec<TotalForma> = formas
        .listar()
        .await?
        .into_iter()
        .map(|f| TotalForma {
            forma_id: f.id,
            rotulo: f.rotulo,
            total_centavos: 0,
        })
        .collect();
    let mut subtotal = 0i64;
    for p in &pedidos {
        if p.cancelado {
            continue; // canceladas aparecem na lista, mas não entram no resumo
        }
        for r in &p.recebimentos {
            subtotal += r.valor_centavos;
            if let Some(t) = totais.iter_mut().find(|t| t.forma_id == r.forma_id) {
                t.total_centavos += r.valor_centavos;
            }
        }
    }
    Ok(RelatorioVendas {
        periodo: periodo.to_string(),
        data: data.to_string(),
        pedidos,
        resumo: ResumoVendas {
            formas: totais,
            subtotal_centavos: subtotal,
        },
    })
}

pub async fn estoque(repo: &dyn RelatorioRepo) -> Result<RelatorioEstoque, ErroApp> {
    let livros = repo.estoque_completo().await?;
    let mut itens = Vec::with_capacity(livros.len());
    let mut valor_total = 0i64;
    for l in livros {
        let valor = l.preco.centavos() * l.estoque;
        valor_total += valor;
        itens.push(ItemEstoque {
            codigo: l.codigo,
            titulo: l.titulo,
            categoria: l.categoria.to_i64(),
            preco_centavos: l.preco.centavos(),
            estoque: l.estoque,
            valor_centavos: valor,
        });
    }
    Ok(RelatorioEstoque {
        titulos: itens.len() as i64,
        valor_total_centavos: valor_total,
        itens,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::ports::{ItemRelatorio, RecebimentoRelatorio, RepoErro};
    use crate::domain::livro::Livro;
    use crate::domain::pagamento::FormaPagamento;
    use async_trait::async_trait;

    fn receb(forma_id: i64, chave: &str, valor: i64) -> RecebimentoRelatorio {
        RecebimentoRelatorio {
            forma_id,
            chave: chave.into(),
            rotulo: chave.into(),
            valor_centavos: valor,
        }
    }

    struct FakeRel;
    #[async_trait]
    impl RelatorioRepo for FakeRel {
        async fn vendas(&self, _d: &str, _p: &str) -> Result<Vec<PedidoRelatorio>, RepoErro> {
            Ok(vec![
                PedidoRelatorio {
                    numero: 1,
                    cliente: "A".into(),
                    itens: vec![ItemRelatorio {
                        alocacoes: vec![],
                        id: 1,
                        codigo: "L1".into(),
                        titulo: "L1".into(),
                        qtd: 1,
                        valor_centavos: 3000,
                    }],
                    recebimentos: vec![receb(1, "credito", 3000)],
                    total_centavos: 3000,
                    cancelado: false,
                },
                PedidoRelatorio {
                    numero: 2,
                    cliente: "B".into(),
                    itens: vec![],
                    recebimentos: vec![
                        receb(3, "dinheiro", 2000),
                        receb(4, "pix", 500),
                        receb(6, "ministerio", 1000),
                    ],
                    total_centavos: 3500,
                    cancelado: false,
                },
            ])
        }
        async fn estoque_completo(&self) -> Result<Vec<Livro>, RepoErro> {
            Ok(vec![])
        }
    }

    struct FakeFormas;
    #[async_trait]
    impl FormaPagamentoRepo for FakeFormas {
        async fn listar(&self) -> Result<Vec<FormaPagamento>, RepoErro> {
            Ok([(1, "credito"), (3, "dinheiro"), (4, "pix"), (6, "ministerio"), (7, "vale")]
                .into_iter()
                .enumerate()
                .map(|(i, (id, chave))| FormaPagamento {
                    id,
                    chave: chave.into(),
                    rotulo: chave.into(),
                    de_sistema: true,
                    ativa: true,
                    ordem: i as i64,
                })
                .collect())
        }
        async fn listar_ativas(&self) -> Result<Vec<FormaPagamento>, RepoErro> {
            self.listar().await
        }
        async fn por_id(&self, id: i64) -> Result<Option<FormaPagamento>, RepoErro> {
            Ok(self.listar().await?.into_iter().find(|f| f.id == id))
        }
        async fn por_chave(&self, chave: &str) -> Result<Option<FormaPagamento>, RepoErro> {
            Ok(self.listar().await?.into_iter().find(|f| f.chave == chave))
        }
        async fn em_uso(&self, _id: i64) -> Result<bool, RepoErro> {
            Ok(true)
        }
        async fn criar(&self, _c: &str, _r: &str, _a: bool, _o: i64) -> Result<FormaPagamento, RepoErro> {
            unimplemented!()
        }
        async fn renomear(&self, _id: i64, _r: &str) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn definir_ativa(&self, _id: i64, _a: bool) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn reordenar(&self, _ids: &[i64]) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn excluir(&self, _id: i64) -> Result<(), RepoErro> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn resumo_dinamico_reconcilia_com_os_pedidos() {
        let rel = vendas("2026-06-14", "dia", &FakeRel, &FakeFormas).await.unwrap();
        let total_de = |id: i64| {
            rel.resumo
                .formas
                .iter()
                .find(|t| t.forma_id == id)
                .map(|t| t.total_centavos)
                .unwrap()
        };
        // Σ por forma (uma entrada por forma do cadastro, zeros incluídos)
        assert_eq!(rel.resumo.formas.len(), 5);
        assert_eq!(total_de(1), 3000);
        assert_eq!(total_de(3), 2000);
        assert_eq!(total_de(4), 500);
        assert_eq!(total_de(6), 1000);
        assert_eq!(total_de(7), 0);
        // Total recebido = todas as formas (inclui Ministério e Vale)
        assert_eq!(rel.resumo.subtotal_centavos, 6500);
        // reconcilia com a soma dos totais dos pedidos (SC-004)
        let soma_totais: i64 = rel.pedidos.iter().map(|p| p.total_centavos).sum();
        let soma_formas: i64 = rel.resumo.formas.iter().map(|t| t.total_centavos).sum();
        assert_eq!(soma_formas, soma_totais);
        assert_eq!(soma_formas, rel.resumo.subtotal_centavos);
    }
}
