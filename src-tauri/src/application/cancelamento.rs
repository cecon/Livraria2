//! Caso de uso: cancelar venda **do turno aberto** (feature 013, FR-003).
//! A regra pura vive em `domain::turno_operacao::pode_cancelar`; aqui só a
//! orquestração. O vínculo com o turno substitui a janela de 5 dias no PDV
//! (ADR-0025): venda de turno já fechado se corrige no escritório.

use crate::application::erros::ErroApp;
use crate::application::ports::PedidoRepo;
use crate::application::ports_turno::TurnoRepo;
use crate::application::turno;
use crate::domain::erros::ErroDominio;
use crate::domain::turno_operacao::pode_cancelar;

/// Cancela uma venda do turno aberto nesta máquina. Venda de outro turno (ou sem
/// turno) → erro claro; venda já cancelada segue idempotente (repo trata).
pub async fn cancelar_venda(
    numero: i64,
    pedidos: &dyn PedidoRepo,
    turnos: &dyn TurnoRepo,
    maquina: &dyn crate::application::ports::Maquina,
) -> Result<(), ErroApp> {
    if let Some(dados) = pedidos.dados_cancelamento(numero).await? {
        if !dados.ja_cancelado {
            let aberto = turno::aberto(turnos, maquina).await?;
            if !pode_cancelar(dados.turno_uid.as_deref(), aberto.as_ref().map(|t| t.sync_uid.as_str())) {
                // Sem turno aberto o PDV nem opera; com turno aberto, a venda é de outro.
                return Err(match aberto {
                    None => ErroDominio::VendaSemTurno.into(),
                    Some(_) => ErroDominio::VendaDeTurnoFechado.into(),
                });
            }
        }
    }
    Ok(pedidos.excluir_pedido(numero).await?)
}
