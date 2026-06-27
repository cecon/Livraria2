//! Composição da aplicação (Hexagonal): conecta os adapters às portas e sobe o Tauri.

pub mod adapters;
pub mod application;
pub mod commands;
pub mod commands_estoque;
pub mod commands_fornecedor;
pub mod commands_inventario;
pub mod commands_lancamento;
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
                // Razão de movimentos: gera saldo inicial por livro (idempotente, FR-006).
                let estoque_repo =
                    adapters::persistencia::estoque_repo::SeaEstoqueRepo::new(db.clone());
                application::estoque_setup::adotar(&estoque_repo)
                    .await
                    .map_err(|e| sea_orm::DbErr::Custom(format!("{e}")))?;
                // Fornecedores: semeia a partir dos textos de fornecedor da 002 (idempotente, FR-005).
                let forn_repo =
                    adapters::persistencia::fornecedor_repo::SeaFornecedorRepo::new(db.clone());
                application::fornecedores::adotar(&forn_repo)
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
            commands::livros_pagina,
            commands::migrar_legado,
            commands::dashboard_do_dia,
            commands::autenticar,
            commands::relatorio_vendas,
            commands::relatorio_estoque,
            commands::excluir_item_pedido,
            commands::excluir_pedido,
            commands::salvar_arquivo,
            commands_estoque::registrar_ajuste,
            commands_estoque::extrato_livro,
            commands_inventario::inventario_abrir,
            commands_inventario::inventario_sessao_aberta,
            commands_inventario::inventario_bipar,
            commands_inventario::inventario_desbipar,
            commands_inventario::inventario_ajustar_item,
            commands_inventario::inventario_revisao,
            commands_inventario::inventario_fechar,
            commands_inventario::inventario_cancelar,
            commands_inventario::inventario_divergencias,
            commands_inventario::inventario_realizados,
            commands_inventario::inventario_relatorio,
            commands_inventario::inventario_pendencias,
            commands_inventario::resolver_pendencia,
            commands_inventario::reabrir_pendencia,
            commands_inventario::buscar_por_codigo_barras,
            commands_fornecedor::fornecedores_listar,
            commands_fornecedor::fornecedor_salvar,
            commands_fornecedor::fornecedor_excluir,
            commands_lancamento::lancamentos_listar,
            commands_lancamento::lancamento_obter,
            commands_lancamento::lancamento_criar,
            commands_lancamento::lancamento_definir_fornecedor,
            commands_lancamento::lancamento_adicionar_item,
            commands_lancamento::lancamento_remover_item,
            commands_lancamento::lancamento_excluir,
            commands_lancamento::lancamento_finalizar,
            commands_lancamento::lancamento_cancelar,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
