//! Porta de entrada Tauri: estado da aplicação e comandos (`invoke`).
//! O wiring/DI dos adapters é montado em `lib.rs::run`.

use crate::adapters::persistencia::inicializar_schema;
use sea_orm::DatabaseConnection;

/// Estado compartilhado da aplicação (injetado nos comandos via `tauri::State`).
/// Por enquanto a conexão; os repositórios entram nos próximos incrementos (US1/US2).
pub struct AppState {
    pub db: DatabaseConnection,
}

/// Aplica as migrations idempotentes sob demanda (FR-061). Seguro re-executar.
#[tauri::command]
pub async fn inicializar_dados(state: tauri::State<'_, AppState>) -> Result<(), String> {
    inicializar_schema(&state.db)
        .await
        .map_err(|e| e.to_string())
}
