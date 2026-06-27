//! Casos de uso: relatórios de vendas/estoque e autenticação (US5, FR-040..044).

use crate::application::erros::ErroApp;
use crate::application::ports::{PedidoRelatorio, RelatorioRepo, UsuarioRepo};
use serde::Serialize;

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResumoVendas {
    pub cartao: i64,
    pub dinheiro: i64,
    pub pix: i64,
    pub ministerio: i64,
    pub vale: i64,
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
) -> Result<RelatorioVendas, ErroApp> {
    let pedidos = repo.vendas(data, periodo).await?;
    let mut r = ResumoVendas::default();
    for p in &pedidos {
        if p.cancelado {
            continue; // canceladas aparecem na lista, mas não entram no resumo
        }
        r.cartao += p.cartao;
        r.dinheiro += p.dinheiro;
        r.pix += p.pix;
        r.ministerio += p.ministerio;
        r.vale += p.vale;
    }
    r.subtotal_centavos = r.cartao + r.dinheiro + r.pix + r.ministerio + r.vale;
    Ok(RelatorioVendas {
        periodo: periodo.to_string(),
        data: data.to_string(),
        pedidos,
        resumo: r,
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
    use crate::application::ports::{ItemRelatorio, RepoErro};
    use crate::domain::livro::Livro;
    use async_trait::async_trait;

    struct FakeRel;
    #[async_trait]
    impl RelatorioRepo for FakeRel {
        async fn vendas(&self, _d: &str, _p: &str) -> Result<Vec<PedidoRelatorio>, RepoErro> {
            Ok(vec![
                PedidoRelatorio {
                    numero: 1,
                    cliente: "A".into(),
                    itens: vec![ItemRelatorio {
                        id: 1,
                        titulo: "L1".into(),
                        qtd: 1,
                        valor_centavos: 3000,
                    }],
                    cartao: 3000,
                    dinheiro: 0,
                    pix: 0,
                    ministerio: 0,
                    vale: 0,
                    total_centavos: 3000,
                    cancelado: false,
                },
                PedidoRelatorio {
                    numero: 2,
                    cliente: "B".into(),
                    itens: vec![],
                    cartao: 0,
                    dinheiro: 2000,
                    pix: 500,
                    ministerio: 1000,
                    vale: 0,
                    total_centavos: 3500,
                    cancelado: false,
                },
            ])
        }
        async fn estoque_completo(&self) -> Result<Vec<Livro>, RepoErro> {
            Ok(vec![])
        }
    }

    #[tokio::test]
    async fn resumo_reconcilia_com_os_pedidos() {
        let rel = vendas("2026-06-14", "dia", &FakeRel).await.unwrap();
        // Σ por forma
        assert_eq!(rel.resumo.cartao, 3000);
        assert_eq!(rel.resumo.dinheiro, 2000);
        assert_eq!(rel.resumo.pix, 500);
        assert_eq!(rel.resumo.ministerio, 1000);
        // Total recebido = todas as formas (inclui Ministério e Vale)
        assert_eq!(rel.resumo.subtotal_centavos, 6500);
        // reconcilia com a soma dos totais dos pedidos (SC-004)
        let soma_totais: i64 = rel.pedidos.iter().map(|p| p.total_centavos).sum();
        let soma_formas = rel.resumo.cartao
            + rel.resumo.dinheiro
            + rel.resumo.pix
            + rel.resumo.ministerio
            + rel.resumo.vale;
        assert_eq!(soma_formas, soma_totais);
    }
}
