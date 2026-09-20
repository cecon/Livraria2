//! Composição da aplicação (Hexagonal): conecta os adapters às portas e sobe o Tauri.

pub mod adapters;
pub mod application;
pub mod commands;
pub mod commands_produtos;
pub mod commands_destinacao;
pub mod commands_estoque;
pub mod commands_formas;
pub mod commands_machine;
pub mod commands_sync;
pub mod commands_turno;
pub mod sync_dispatch;
pub mod shift_sync;
pub mod cash_sync;
// Domínio extraído para o crate `livraria-domain` (ADR-0022). Re-exporta como
// `crate::domain` para manter todas as referências existentes (`crate::domain::…`).
pub use livraria_domain as domain;
pub mod migration;
pub mod machine_config;

use commands::AppState;
use commands_formas::BootState;
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
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let url = db_url(app)?;
            // Conecta e aplica as migrations idempotentes na subida (FR-061).
            let resultado: Result<DatabaseConnection, sea_orm::DbErr> =
                tauri::async_runtime::block_on(async {
                    let db = adapters::persistencia::conectar(&url).await?;
                    adapters::persistencia::inicializar_schema(&db).await?;
                    // Feature 012 ("a nuvem manda"): o PDV NÃO semeia mais o admin.
                    // Num install limpo o banco nasce sem usuários e os baixa da nuvem
                    // (com senha_hash + perfil — feature 010) no 1º sync. Assim nada de
                    // seed sobe/corrompe a nuvem e o cadastro de usuários vive só lá.
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
                    Ok(db)
                });
            // FR-016a: falha de migração NÃO derruba o app — ele abre apenas para
            // exibir o erro. A integridade deve ser verificada antes da recuperação.
            // O frontend consulta `estado_boot` e bloqueia a operação.
            match resultado {
                Ok(db) => {
                    // Feature 007: config da nuvem em <app_config_dir>/sync.json (ou env vars).
                    let config_sync_path = tauri::Manager::path(app)
                        .app_config_dir()
                        .ok()
                        .map(|d| d.join("sync.json"));
                    let machine_config_path = tauri::Manager::path(app)
                        .app_config_dir()
                        .ok()
                        .map(|d| d.join("machine.json"));
                    app.manage(AppState {
                        db: db.clone(),
                        config_sync_path: config_sync_path.clone(),
                        machine_config_path: machine_config_path.clone(),
                    });
                    app.manage(BootState { erro_migracao: None });
                    // Sincronização em background (oportunista, não bloqueia a venda).
                    tauri::async_runtime::spawn(sincronizacao_periodica(
                        db, config_sync_path, machine_config_path,
                    ));
                }
                Err(e) => {
                    eprintln!("boot: migração falhou — app bloqueado para operação: {e}");
                    app.manage(BootState {
                        erro_migracao: Some(e.to_string()),
                    });
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands_formas::estado_boot,
            commands_machine::estado_maquina,
            commands_machine::configurar_maquina,
            commands_formas::listar_formas_ativas,
            commands::proximo_numero_pedido,
            commands::registrar_venda,
            commands_turno::turno_aberto,
            commands_turno::turno_abrir,
            commands_turno::turno_resumo,
            commands_turno::turno_encerrar,
            commands_turno::caixa_movimento_registrar,
            commands_turno::caixa_movimentos_listar,
            commands_turno::vendas_do_turno,
            commands::livro_por_codigo,
            commands::buscar_por_texto,
            commands::autenticar,
            commands_produtos::produto_consultar,
            commands_produtos::produtos_listar,
            commands_produtos::produto_salvar,
            commands::relatorio_vendas,
            commands::relatorio_estoque,
            commands::excluir_pedido,
            commands::salvar_arquivo,
            commands_estoque::extrato_livro,
            commands_sync::sincronizar_agora,
            commands_sync::status_sincronizacao,
            commands_sync::seed_inicial,
            commands_sync::listar_operadores,
            commands_destinacao::relatorio_destinacoes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Feature 007: loop de sincronização em background. Oportunista — se não houver
/// config/rede, apenas dorme e tenta de novo; nunca bloqueia a operação do PDV.
async fn sincronizacao_periodica(
    db: DatabaseConnection,
    config_path: Option<std::path::PathBuf>,
    machine_config_path: Option<std::path::PathBuf>,
) {
    // Espera o app assentar antes da 1ª tentativa.
    tokio::time::sleep(std::time::Duration::from_secs(15)).await;
    loop {
        {
            match sync_dispatch::executar(
                &db, config_path.as_deref(), machine_config_path.as_deref(),
            ).await {
                Ok(r) if r.enviados + r.recebidos > 0 => {
                    eprintln!("sync: enviados={} recebidos={} orfas={}", r.enviados, r.recebidos, r.orfas);
                }
                Ok(_) => {}
                Err(e) => eprintln!("sync falhou (segue offline): {e}"),
            }
        }
        tokio::select! {
            _ = sync_dispatch::wait_request() => {},
            _ = tokio::time::sleep(std::time::Duration::from_secs(60)) => {},
        }
    }
}
