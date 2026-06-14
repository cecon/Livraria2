//! Caso de uso: registrar venda no PDV (US1, FR-010..017). Orquestra domínio + portas.

use crate::application::erros::ErroApp;
use crate::application::ports::{LivroRepo, PedidoRepo, Relogio};
use crate::domain::dinheiro::Dinheiro;
use crate::domain::erros::ErroDominio;
use crate::domain::pagamento::Turno;
use crate::domain::pedido::{somar_item, ItemPedido, Pagamentos, Pedido};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ItemInput {
    pub codigo: String,
    pub qtd: i64,
}

#[derive(Debug, Default, Deserialize)]
pub struct PagamentosInput {
    #[serde(default)]
    pub cartao: i64,
    #[serde(default)]
    pub dinheiro: i64,
    #[serde(default)]
    pub pix: i64,
    #[serde(default)]
    pub ministerio: i64,
    #[serde(default)]
    pub vale: i64,
}

#[derive(Debug, Deserialize)]
pub struct VendaInput {
    #[serde(default)]
    pub cliente: String,
    pub itens: Vec<ItemInput>,
    #[serde(default)]
    pub pagamentos: PagamentosInput,
}

/// Próximo número de pedido (FR-017).
pub async fn proximo_numero_pedido(pedidos: &dyn PedidoRepo) -> Result<i64, ErroApp> {
    Ok(pedidos.proximo_numero().await?)
}

/// Registra a venda: busca cada livro (snapshot de título/preço), monta o pedido,
/// valida (≥1 item e pago ≥ total) e persiste baixando o estoque (FR-014/015/016).
pub async fn registrar_venda(
    input: VendaInput,
    livros: &dyn LivroRepo,
    pedidos: &dyn PedidoRepo,
    relogio: &dyn Relogio,
) -> Result<Pedido, ErroApp> {
    let numero = pedidos.proximo_numero().await?;

    let mut itens: Vec<ItemPedido> = Vec::new();
    for it in &input.itens {
        let livro = livros
            .por_codigo(&it.codigo)
            .await?
            .ok_or(ErroDominio::LivroNaoEncontrado)?;
        somar_item(
            &mut itens,
            ItemPedido {
                codigo: livro.codigo.clone(),
                titulo: livro.titulo.clone(),
                preco: livro.preco,
                qtd: it.qtd,
            },
        )?;
    }

    let p = &input.pagamentos;
    let cliente = if input.cliente.trim().is_empty() {
        "CLIENTE".to_string()
    } else {
        input.cliente.trim().to_string()
    };
    let pedido = Pedido {
        numero,
        cliente,
        turno: Turno::de_hora(relogio.hora_atual()),
        data: relogio.hoje_iso(),
        itens,
        pagamentos: Pagamentos {
            cartao: Dinheiro::de_centavos(p.cartao),
            dinheiro: Dinheiro::de_centavos(p.dinheiro),
            pix: Dinheiro::de_centavos(p.pix),
            ministerio: Dinheiro::de_centavos(p.ministerio),
            vale: Dinheiro::de_centavos(p.vale),
        },
    };

    pedido.validar_conclusao()?;
    pedidos.registrar(&pedido).await?;
    Ok(pedido)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::ports::RepoErro;
    use crate::domain::categoria::Categoria;
    use crate::domain::livro::Livro;
    use async_trait::async_trait;
    use std::sync::Mutex;

    struct FakeLivros {
        acervo: Vec<Livro>,
    }

    #[async_trait]
    impl LivroRepo for FakeLivros {
        async fn por_codigo(&self, codigo: &str) -> Result<Option<Livro>, RepoErro> {
            Ok(self.acervo.iter().find(|l| l.codigo == codigo).cloned())
        }
        async fn salvar(&self, _l: &Livro) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn inativar(&self, _codigo: &str) -> Result<(), RepoErro> {
            Ok(())
        }
        async fn recentes(&self, _limite: i64) -> Result<Vec<Livro>, RepoErro> {
            Ok(vec![])
        }
        async fn buscar_texto(&self, _t: &str, _l: i64) -> Result<Vec<Livro>, RepoErro> {
            Ok(vec![])
        }
    }

    #[derive(Default)]
    struct FakePedidos {
        registrado: Mutex<Option<Pedido>>,
    }

    #[async_trait]
    impl PedidoRepo for FakePedidos {
        async fn proximo_numero(&self) -> Result<i64, RepoErro> {
            Ok(5997)
        }
        async fn registrar(&self, pedido: &Pedido) -> Result<(), RepoErro> {
            *self.registrado.lock().unwrap() = Some(pedido.clone());
            Ok(())
        }
    }

    struct RelogioFixo;
    impl Relogio for RelogioFixo {
        fn hora_atual(&self) -> u32 {
            10
        }
        fn hoje_iso(&self) -> String {
            "2026-06-14".to_string()
        }
    }

    fn acervo() -> FakeLivros {
        FakeLivros {
            acervo: vec![Livro {
                codigo: "9788573671469".into(),
                titulo: "A Cruz de Cristo".into(),
                autor: Some("John Stott".into()),
                preco: Dinheiro::de_centavos(3000),
                categoria: Categoria::EstudoTeologia,
                estoque: 10,
                descricao: None,
            }],
        }
    }

    fn input(qtd: i64, dinheiro: i64) -> VendaInput {
        VendaInput {
            cliente: "".into(),
            itens: vec![ItemInput {
                codigo: "9788573671469".into(),
                qtd,
            }],
            pagamentos: PagamentosInput {
                dinheiro,
                ..Default::default()
            },
        }
    }

    #[tokio::test]
    async fn venda_ok_monta_pedido_com_snapshot_e_turno() {
        let pedidos = FakePedidos::default();
        let pedido = registrar_venda(input(2, 6000), &acervo(), &pedidos, &RelogioFixo)
            .await
            .unwrap();
        assert_eq!(pedido.numero, 5997);
        assert_eq!(pedido.cliente, "CLIENTE");
        assert_eq!(pedido.turno, Turno::Manha);
        assert_eq!(pedido.total().centavos(), 6000);
        assert_eq!(pedido.itens[0].titulo, "A Cruz de Cristo");
        assert!(pedidos.registrado.lock().unwrap().is_some());
    }

    #[tokio::test]
    async fn venda_bloqueia_pago_insuficiente() {
        let pedidos = FakePedidos::default();
        let r = registrar_venda(input(1, 1000), &acervo(), &pedidos, &RelogioFixo).await;
        assert!(matches!(
            r,
            Err(ErroApp::Dominio(ErroDominio::PagoInsuficiente { .. }))
        ));
        assert!(pedidos.registrado.lock().unwrap().is_none());
    }

    #[tokio::test]
    async fn venda_codigo_inexistente() {
        let pedidos = FakePedidos::default();
        let mut inp = input(1, 3000);
        inp.itens[0].codigo = "0000".into();
        let r = registrar_venda(inp, &acervo(), &pedidos, &RelogioFixo).await;
        assert!(matches!(
            r,
            Err(ErroApp::Dominio(ErroDominio::LivroNaoEncontrado))
        ));
    }
}
