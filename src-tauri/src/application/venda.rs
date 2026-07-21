//! Caso de uso: registrar venda no PDV (US1, FR-010..017). Orquestra domínio + portas.
//! Pagamentos chegam como lista `{forma_id, valor}` (cadastro de formas — ADR-0013).

use crate::application::erros::ErroApp;
use crate::application::ports::{FormaPagamentoRepo, LivroRepo, PedidoRepo, Relogio};
use crate::domain::dinheiro::Dinheiro;
use crate::domain::erros::ErroDominio;
use crate::domain::pagamento::{ChaveSistema, Turno};
use crate::domain::pedido::{somar_item, ItemPedido, Pedido, Recebimento};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ItemInput {
    pub codigo: String,
    pub qtd: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecebimentoInput {
    pub forma_id: i64,
    pub valor_centavos: i64,
}

#[derive(Debug, Deserialize)]
pub struct VendaInput {
    #[serde(default)]
    pub cliente: String,
    pub itens: Vec<ItemInput>,
    #[serde(default)]
    pub pagamentos: Vec<RecebimentoInput>,
    /// Operador logado no PDV (FR-023). Opcional; vazio/ausente → venda sem atribuição.
    #[serde(default)]
    pub operador: Option<String>,
}

/// Próximo número de pedido (FR-017).
pub async fn proximo_numero_pedido(pedidos: &dyn PedidoRepo) -> Result<i64, ErroApp> {
    Ok(pedidos.proximo_numero().await?)
}

/// Registra a venda: busca cada livro (snapshot de título/preço), valida cada forma
/// de pagamento (existe e está ativa — FR-012), monta o pedido, valida a conclusão
/// (pago ≥ total; troco só do Dinheiro, resolvido por chave — FR-013) e persiste.
pub async fn registrar_venda(
    input: VendaInput,
    livros: &dyn LivroRepo,
    pedidos: &dyn PedidoRepo,
    formas: &dyn FormaPagamentoRepo,
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

    let mut pagamentos = Vec::new();
    for p in &input.pagamentos {
        if p.valor_centavos <= 0 {
            continue; // esparso: só formas com valor
        }
        let forma = formas
            .por_id(p.forma_id)
            .await?
            .ok_or(ErroDominio::FormaNaoEncontrada)?;
        if !forma.ativa {
            return Err(ErroDominio::FormaInativa.into());
        }
        pagamentos.push(Recebimento {
            forma_id: p.forma_id,
            valor: Dinheiro::de_centavos(p.valor_centavos),
        });
    }

    // Troco amarrado à forma de sistema "Dinheiro" pela chave estável (FR-013).
    let dinheiro = formas
        .por_chave(ChaveSistema::Dinheiro.chave())
        .await?
        .ok_or(ErroDominio::FormaNaoEncontrada)?;

    let cliente = if input.cliente.trim().is_empty() {
        "CLIENTE".to_string()
    } else {
        input.cliente.trim().to_string()
    };
    let operador = input.operador.and_then(|o| {
        let o = o.trim().to_string();
        if o.is_empty() { None } else { Some(o) }
    });
    let pedido = Pedido {
        numero,
        cliente,
        turno: Turno::de_hora(relogio.hora_atual()),
        data: relogio.hoje_iso(),
        itens,
        pagamentos,
        operador,
    };

    pedido.validar_conclusao(dinheiro.id)?;
    pedidos.registrar(&pedido).await?;
    Ok(pedido)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::fakes::{FakeFormas, FakeLivros, FakePedidos, RelogioFixo};
    use crate::domain::categoria::Categoria;
    use crate::domain::livro::Livro;

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
                custo_medio: Dinheiro::ZERO,
            }],
        }
    }

    fn input(qtd: i64, pagamentos: Vec<RecebimentoInput>) -> VendaInput {
        VendaInput {
            cliente: "".into(),
            itens: vec![ItemInput {
                codigo: "9788573671469".into(),
                qtd,
            }],
            pagamentos,
            operador: None,
        }
    }

    fn pag(forma_id: i64, valor_centavos: i64) -> RecebimentoInput {
        RecebimentoInput {
            forma_id,
            valor_centavos,
        }
    }

    #[tokio::test]
    async fn venda_ok_monta_pedido_com_snapshot_e_turno() {
        let pedidos = FakePedidos::default();
        let pedido = registrar_venda(
            input(2, vec![pag(3, 6000)]),
            &acervo(),
            &pedidos,
            &FakeFormas,
            &RelogioFixo,
        )
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
    async fn venda_multiforma_grava_recebimentos_separados() {
        let pedidos = FakePedidos::default();
        let pedido = registrar_venda(
            input(2, vec![pag(1, 4000), pag(3, 2000)]),
            &acervo(),
            &pedidos,
            &FakeFormas,
            &RelogioFixo,
        )
        .await
        .unwrap();
        assert_eq!(pedido.pagamentos.len(), 2);
        assert_eq!(pedido.troco().centavos(), 0);
    }

    #[tokio::test]
    async fn venda_bloqueia_pago_insuficiente() {
        let pedidos = FakePedidos::default();
        let r = registrar_venda(
            input(1, vec![pag(3, 1000)]),
            &acervo(),
            &pedidos,
            &FakeFormas,
            &RelogioFixo,
        )
        .await;
        assert!(matches!(
            r,
            Err(ErroApp::Dominio(ErroDominio::PagoInsuficiente { .. }))
        ));
        assert!(pedidos.registrado.lock().unwrap().is_none());
    }

    #[tokio::test]
    async fn venda_bloqueia_forma_inativa_e_inexistente() {
        let pedidos = FakePedidos::default();
        let r = registrar_venda(
            input(1, vec![pag(9, 3000)]),
            &acervo(),
            &pedidos,
            &FakeFormas,
            &RelogioFixo,
        )
        .await;
        assert!(matches!(r, Err(ErroApp::Dominio(ErroDominio::FormaInativa))));

        let r = registrar_venda(
            input(1, vec![pag(77, 3000)]),
            &acervo(),
            &pedidos,
            &FakeFormas,
            &RelogioFixo,
        )
        .await;
        assert!(matches!(
            r,
            Err(ErroApp::Dominio(ErroDominio::FormaNaoEncontrada))
        ));
    }

    #[tokio::test]
    async fn venda_codigo_inexistente() {
        let pedidos = FakePedidos::default();
        let mut inp = input(1, vec![pag(3, 3000)]);
        inp.itens[0].codigo = "0000".into();
        let r = registrar_venda(inp, &acervo(), &pedidos, &FakeFormas, &RelogioFixo).await;
        assert!(matches!(
            r,
            Err(ErroApp::Dominio(ErroDominio::LivroNaoEncontrado))
        ));
    }
}
