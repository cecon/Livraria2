//! Caso de uso: migração/sincronização do legado (FR-065..069). Idempotente (upsert).

use crate::application::erros::ErroApp;
use crate::application::ports::{FormaPagamentoRepo, ImportadorLegado, LivroRepo, PedidoRepo};
use crate::domain::erros::ErroDominio;
use crate::domain::pagamento::{ChaveSistema, FormaIds};
use serde::Serialize;

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelatorioMigracao {
    pub livros_importados: i64,
    pub pedidos_inseridos: i64,
    pub pedidos_existentes: i64,
    pub divergencias: Vec<String>,
}

/// Resolve os ids das formas de sistema pela chave estável (FR-018). Como são
/// formas de sistema (não excluíveis), o mapeamento nunca fica órfão.
async fn resolver_formas(repo: &dyn FormaPagamentoRepo) -> Result<FormaIds, ErroApp> {
    let id_de = |chave: ChaveSistema| async move {
        repo.por_chave(chave.chave())
            .await?
            .map(|f| f.id)
            .ok_or_else(|| ErroApp::from(ErroDominio::FormaNaoEncontrada))
    };
    Ok(FormaIds {
        credito: id_de(ChaveSistema::Credito).await?,
        dinheiro: id_de(ChaveSistema::Dinheiro).await?,
        pix: id_de(ChaveSistema::Pix).await?,
        ministerio: id_de(ChaveSistema::Ministerio).await?,
        vale: id_de(ChaveSistema::Vale).await?,
    })
}

/// Importa acervo (upsert) e pedidos (insert idempotente). Re-executável (FR-069):
/// livros são atualizados, pedidos já existentes são ignorados.
pub async fn migrar(
    imp: &dyn ImportadorLegado,
    livros: &dyn LivroRepo,
    pedidos: &dyn PedidoRepo,
    formas: &dyn FormaPagamentoRepo,
) -> Result<RelatorioMigracao, ErroApp> {
    let mut rel = RelatorioMigracao::default();

    for livro in imp.livros()? {
        livros.salvar(&livro).await?;
        rel.livros_importados += 1;
    }

    let forma_ids = resolver_formas(formas).await?;
    let importados = imp.pedidos(&forma_ids)?;
    rel.divergencias = importados.divergencias;
    for pedido in &importados.pedidos {
        if pedidos.importar(pedido).await? {
            rel.pedidos_inseridos += 1;
        } else {
            rel.pedidos_existentes += 1;
        }
    }
    Ok(rel)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::ports::{PedidosImportados, RepoErro};
    use crate::domain::categoria::Categoria;
    use crate::domain::dinheiro::Dinheiro;
    use crate::domain::livro::Livro;
    use crate::domain::pagamento::{FormaPagamento, Turno};
    use crate::domain::pedido::{ItemPedido, Pedido, Recebimento};
    use async_trait::async_trait;
    use std::sync::Mutex;

    struct FakeImp;
    impl ImportadorLegado for FakeImp {
        fn livros(&self) -> Result<Vec<Livro>, RepoErro> {
            Ok(vec![Livro {
                codigo: "111".into(),
                titulo: "Bíblia".into(),
                autor: None,
                preco: Dinheiro::de_centavos(3000),
                categoria: Categoria::Biblias,
                estoque: 5,
                descricao: None,
                custo_medio: Dinheiro::ZERO,
            }])
        }
        fn pedidos(&self, formas: &FormaIds) -> Result<PedidosImportados, RepoErro> {
            Ok(PedidosImportados {
                pedidos: vec![Pedido {
                    numero: 100,
                    cliente: "CLIENTE".into(),
                    turno: Turno::Manha,
                    data: "2025-07-05".into(),
                    itens: vec![ItemPedido {
                        codigo: "111".into(),
                        titulo: "Bíblia".into(),
                        preco: Dinheiro::de_centavos(3000),
                        qtd: 1,
                    }],
                    pagamentos: vec![Recebimento {
                        forma_id: formas.dinheiro,
                        valor: Dinheiro::de_centavos(3000),
                    }],
                }],
                divergencias: vec![],
            })
        }
    }

    struct FakeFormas;
    #[async_trait]
    impl FormaPagamentoRepo for FakeFormas {
        async fn listar(&self) -> Result<Vec<FormaPagamento>, RepoErro> {
            Ok(["credito", "debito", "dinheiro", "pix", "pix_igreja", "ministerio", "vale"]
                .iter()
                .enumerate()
                .map(|(i, chave)| FormaPagamento {
                    id: i as i64 + 1,
                    chave: (*chave).into(),
                    rotulo: (*chave).into(),
                    de_sistema: !matches!(*chave, "debito" | "pix_igreja"),
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
            Ok(false)
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

    #[derive(Default)]
    struct FakeLivros {
        n: Mutex<i64>,
    }
    #[async_trait]
    impl LivroRepo for FakeLivros {
        async fn por_codigo(&self, _c: &str) -> Result<Option<Livro>, RepoErro> {
            Ok(None)
        }
        async fn salvar(&self, _l: &Livro) -> Result<(), RepoErro> {
            *self.n.lock().unwrap() += 1;
            Ok(())
        }
        async fn inativar(&self, _c: &str) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn recentes(&self, _l: i64) -> Result<Vec<Livro>, RepoErro> {
            Ok(vec![])
        }
        async fn buscar_texto(&self, _t: &str, _l: i64) -> Result<Vec<Livro>, RepoErro> {
            Ok(vec![])
        }
    }

    struct FakePedidos {
        existentes: Mutex<Vec<i64>>,
    }
    #[async_trait]
    impl PedidoRepo for FakePedidos {
        async fn proximo_numero(&self) -> Result<i64, RepoErro> {
            Ok(1)
        }
        async fn registrar(&self, _p: &Pedido) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn importar(&self, p: &Pedido) -> Result<bool, RepoErro> {
            let mut e = self.existentes.lock().unwrap();
            if e.contains(&p.numero) {
                Ok(false)
            } else {
                e.push(p.numero);
                Ok(true)
            }
        }
        async fn excluir_item(&self, _item_id: i64) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn excluir_pedido(&self, _numero: i64) -> Result<(), RepoErro> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn migra_e_e_idempotente() {
        let imp = FakeImp;
        let livros = FakeLivros::default();
        let pedidos = FakePedidos {
            existentes: Mutex::new(vec![]),
        };

        let r1 = migrar(&imp, &livros, &pedidos, &FakeFormas).await.unwrap();
        assert_eq!(r1.livros_importados, 1);
        assert_eq!(r1.pedidos_inseridos, 1);
        assert_eq!(r1.pedidos_existentes, 0);

        // Segunda execução: pedido já existe → não duplica (FR-069).
        let r2 = migrar(&imp, &livros, &pedidos, &FakeFormas).await.unwrap();
        assert_eq!(r2.pedidos_inseridos, 0);
        assert_eq!(r2.pedidos_existentes, 1);
    }
}
