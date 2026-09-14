//! Comandos Tauri do cadastro de formas de pagamento (US2) e estado do boot
//! (FR-016a). DTOs em camelCase (contracts/tauri-commands.md).

use crate::adapters::persistencia::forma_pagamento_repo::SeaFormaPagamentoRepo;
use crate::application::formas_pagamento;
use crate::commands::{AppState, ErroDto};
use crate::domain::pagamento::FormaPagamento;
use serde::Serialize;

/// Estado do boot exposto ao frontend: em falha de migração o app abre apenas
/// para exibir o erro — nenhuma operação fica disponível (FR-016a).
pub struct BootState {
    pub erro_migracao: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EstadoBootDto {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub erro_migracao: Option<String>,
}

/// A falha é dado, não exceção: este comando sempre responde.
#[tauri::command]
pub fn estado_boot(boot: tauri::State<'_, BootState>) -> EstadoBootDto {
    EstadoBootDto {
        ok: boot.erro_migracao.is_none(),
        erro_migracao: boot.erro_migracao.clone(),
    }
}


/// Só ativas, por ordem (PDV — FR-012).
#[tauri::command]
pub async fn listar_formas_ativas(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<FormaPagamento>, ErroDto> {
    let repo = SeaFormaPagamentoRepo::new(state.db.clone());
    Ok(formas_pagamento::listar_ativas(&repo).await?)
}





