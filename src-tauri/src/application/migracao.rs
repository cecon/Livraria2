//! Caso de uso: migração/sincronização do legado (FR-065..069). Idempotente (upsert).

use crate::application::erros::ErroApp;
use crate::application::ports::{ImportadorLegado, LivroRepo, PedidoRepo};
use serde::Serialize;

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelatorioMigracao {
    pub livros_importados: i64,
    pub pedidos_inseridos: i64,
    pub pedidos_existentes: i64,
    pub divergencias: Vec<String>,
}

/// Importa acervo (upsert) e pedidos (insert idempotente). Re-executável (FR-069):
/// livros são atualizados, pedidos já existentes são ignorados.
pub async fn migrar(
    imp: &dyn ImportadorLegado,
    livros: &dyn LivroRepo,
    pedidos: &dyn PedidoRepo,
) -> Result<RelatorioMigracao, ErroApp> {
    let mut rel = RelatorioMigracao::default();

    for livro in imp.livros()? {
        livros.salvar(&livro).await?;
        rel.livros_importados += 1;
    }

    let importados = imp.pedidos()?;
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
    use crate::domain::pagamento::Turno;
    use crate::domain::pedido::{ItemPedido, Pagamentos, Pedido};
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
            }])
        }
        fn pedidos(&self) -> Result<PedidosImportados, RepoErro> {
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
                    pagamentos: Pagamentos::default(),
                }],
                divergencias: vec![],
            })
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
    }

    #[tokio::test]
    async fn migra_e_e_idempotente() {
        let imp = FakeImp;
        let livros = FakeLivros::default();
        let pedidos = FakePedidos {
            existentes: Mutex::new(vec![]),
        };

        let r1 = migrar(&imp, &livros, &pedidos).await.unwrap();
        assert_eq!(r1.livros_importados, 1);
        assert_eq!(r1.pedidos_inseridos, 1);
        assert_eq!(r1.pedidos_existentes, 0);

        // Segunda execução: pedido já existe → não duplica (FR-069).
        let r2 = migrar(&imp, &livros, &pedidos).await.unwrap();
        assert_eq!(r2.pedidos_inseridos, 0);
        assert_eq!(r2.pedidos_existentes, 1);
    }
}
