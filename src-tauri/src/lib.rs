//! Composição da aplicação (Hexagonal): conecta os adapters às portas e sobe o Tauri.

pub mod adapters;
pub mod application;
pub mod commands;
pub mod domain;
pub mod migration;

use commands::AppState;
use sea_orm::DatabaseConnection;
use tauri::Manager;

/// Resolve o caminho do banco SQLite no diretório de dados do app e garante o diretório.
fn db_url(app: &tauri::App) -> Result<String, Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    let caminho = dir.join("livraria.db");
    Ok(format!("sqlite://{}?mode=rwc", caminho.display()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let url = db_url(app)?;
            // Conecta e aplica as migrations idempotentes na subida (FR-061).
            let db: DatabaseConnection = tauri::async_runtime::block_on(async {
                let db = adapters::persistencia::conectar(&url).await?;
                adapters::persistencia::inicializar_schema(&db).await?;
                // Gate de relatórios: garante o admin padrão (adm/adm).
                use application::ports::UsuarioRepo;
                adapters::persistencia::usuario_repo::SeaUsuarioRepo::new(db.clone())
                    .garantir_admin()
                    .await
                    .map_err(|e| sea_orm::DbErr::Custom(format!("{e}")))?;
                Ok::<_, sea_orm::DbErr>(db)
            })?;
            app.manage(AppState { db });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::inicializar_dados,
            commands::proximo_numero_pedido,
            commands::registrar_venda,
            commands::livro_por_codigo,
            commands::buscar_por_texto,
            commands::salvar_livro,
            commands::excluir_livro,
            commands::livros_recentes,
            commands::migrar_legado,
            commands::dashboard_do_dia,
            commands::autenticar,
            commands::relatorio_vendas,
            commands::relatorio_estoque,
            commands::excluir_item_pedido,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
