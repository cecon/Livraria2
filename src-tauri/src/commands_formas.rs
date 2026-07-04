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

/// Todas as formas, por ordem (inclui inativas — tela de cadastro).
#[tauri::command]
pub async fn listar_formas(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<FormaPagamento>, ErroDto> {
    let repo = SeaFormaPagamentoRepo::new(state.db.clone());
    Ok(formas_pagamento::listar(&repo).await?)
}

/// Só ativas, por ordem (PDV — FR-012).
#[tauri::command]
pub async fn listar_formas_ativas(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<FormaPagamento>, ErroDto> {
    let repo = SeaFormaPagamentoRepo::new(state.db.clone());
    Ok(formas_pagamento::listar_ativas(&repo).await?)
}

/// Cria uma forma livre (FR-005).
#[tauri::command]
pub async fn criar_forma(
    state: tauri::State<'_, AppState>,
    rotulo: String,
    ativa: bool,
) -> Result<FormaPagamento, ErroDto> {
    let repo = SeaFormaPagamentoRepo::new(state.db.clone());
    Ok(formas_pagamento::criar(&rotulo, ativa, &repo).await?)
}

/// Renomeia mantendo a identidade (FR-006).
#[tauri::command]
pub async fn renomear_forma(
    state: tauri::State<'_, AppState>,
    id: i64,
    rotulo: String,
) -> Result<FormaPagamento, ErroDto> {
    let repo = SeaFormaPagamentoRepo::new(state.db.clone());
    Ok(formas_pagamento::renomear(id, &rotulo, &repo).await?)
}

/// Ativa/desativa (FR-007); reativação com nome conflitante é bloqueada (D9).
#[tauri::command]
pub async fn definir_forma_ativa(
    state: tauri::State<'_, AppState>,
    id: i64,
    ativa: bool,
) -> Result<FormaPagamento, ErroDto> {
    let repo = SeaFormaPagamentoRepo::new(state.db.clone());
    Ok(formas_pagamento::definir_ativa(id, ativa, &repo).await?)
}

/// Reordena a exibição (FR-008).
#[tauri::command]
pub async fn reordenar_formas(
    state: tauri::State<'_, AppState>,
    ids_ordenados: Vec<i64>,
) -> Result<Vec<FormaPagamento>, ErroDto> {
    let repo = SeaFormaPagamentoRepo::new(state.db.clone());
    Ok(formas_pagamento::reordenar(&ids_ordenados, &repo).await?)
}

/// Exclui forma livre nunca usada (FR-009); em uso/de sistema → erro claro.
#[tauri::command]
pub async fn excluir_forma(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), ErroDto> {
    let repo = SeaFormaPagamentoRepo::new(state.db.clone());
    formas_pagamento::excluir(id, &repo).await?;
    Ok(())
}
