//! Caso de uso: cancelar venda com a janela de 5 dias corridos (FR-011 da 006).
//! A regra pura vive em `domain::pedido::pode_cancelar_venda`; aqui só a orquestração.

use crate::application::erros::ErroApp;
use crate::application::ports::{PedidoRepo, Relogio};
use crate::domain::erros::ErroDominio;
use crate::domain::pedido::{pode_cancelar_venda, JANELA_CANCELAMENTO_DIAS};

/// Cancela uma venda dentro da janela de 5 dias corridos (FR-011 da 006).
/// Venda antiga → erro claro; venda já cancelada segue idempotente (repo trata).
pub async fn cancelar_venda(
    numero: i64,
    pedidos: &dyn PedidoRepo,
    relogio: &dyn Relogio,
) -> Result<(), ErroApp> {
    if let Some((data, ja_cancelado)) = pedidos.dados_cancelamento(numero).await? {
        if !ja_cancelado && !pode_cancelar_venda(&data, &relogio.hoje_iso()) {
            return Err(ErroDominio::VendaAntiga {
                dias: JANELA_CANCELAMENTO_DIAS,
            }
            .into());
        }
    }
    Ok(pedidos.excluir_pedido(numero).await?)
}
