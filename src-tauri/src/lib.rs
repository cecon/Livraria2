//! Composição da aplicação (Hexagonal): conecta os adapters às portas e sobe o Tauri.

pub mod adapters;
pub mod application;
pub mod commands;
pub mod commands_destinacao;
pub mod commands_estoque;
pub mod commands_formas;
pub mod commands_fornecedor;
pub mod commands_inventario;
pub mod commands_lancamento;
pub mod commands_sync;
// Domínio extraído para o crate `livraria-domain` (ADR-0022). Re-exporta como
// `crate::domain` para manter todas as referências existentes (`crate::domain::…`).
pub use livraria_domain as domain;
pub mod migration;

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
                    Ok(db)
                });
            // FR-016a: falha de migração NÃO derruba o app — ele abre apenas para
            // exibir o erro (a migração sofreu rollback; nenhum dado foi perdido).
            // O frontend consulta `estado_boot` e bloqueia a operação.
            match resultado {
                Ok(db) => {
                    // Feature 007: config da nuvem em <app_config_dir>/sync.json (ou env vars).
                    let config_sync_path = tauri::Manager::path(app)
                        .app_config_dir()
                        .ok()
                        .map(|d| d.join("sync.json"));
                    app.manage(AppState {
                        db: db.clone(),
                        config_sync_path: config_sync_path.clone(),
                    });
                    app.manage(BootState { erro_migracao: None });
                    // Sincronização em background (oportunista, não bloqueia a venda).
                    tauri::async_runtime::spawn(sincronizacao_periodica(db, config_sync_path));
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
            commands_formas::listar_formas,
            commands_formas::listar_formas_ativas,
            commands_formas::criar_forma,
            commands_formas::renomear_forma,
            commands_formas::definir_forma_ativa,
            commands_formas::reordenar_formas,
            commands_formas::excluir_forma,
            commands::inicializar_dados,
            commands::proximo_numero_pedido,
            commands::registrar_venda,
            commands::turno_aberto,
            commands::turno_abrir,
            commands::turno_resumo,
            commands::turno_encerrar,
            commands::turno_listar,
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
            commands_sync::sincronizar_agora,
            commands_sync::status_sincronizacao,
            commands_sync::seed_inicial,
            commands_sync::listar_operadores,
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
            commands_destinacao::destinacoes_listar,
            commands_destinacao::destinacoes_listar_ativas,
            commands_destinacao::destinacao_criar,
            commands_destinacao::destinacao_renomear,
            commands_destinacao::destinacao_definir_ativa,
            commands_destinacao::destinacao_reordenar,
            commands_destinacao::destinacao_excluir,
            commands_destinacao::destinacao_saldos_livro,
            commands_destinacao::destinacao_transferir,
            commands_destinacao::destinacao_transferencias_livro,
            commands_destinacao::relatorio_destinacoes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Feature 007: loop de sincronização em background. Oportunista — se não houver
/// config/rede, apenas dorme e tenta de novo; nunca bloqueia a operação do PDV.
async fn sincronizacao_periodica(db: DatabaseConnection, config_path: Option<std::path::PathBuf>) {
    use adapters::nuvem::supabase_sync::SupabaseSync;
    use adapters::persistencia::replica_sync::SeaReplicaSync;
    // Espera o app assentar antes da 1ª tentativa.
    tokio::time::sleep(std::time::Duration::from_secs(15)).await;
    loop {
        if let Ok(nuvem) = SupabaseSync::conectar(config_path.as_deref()).await {
            let local = SeaReplicaSync::new(db.clone());
            match application::sincronizacao::sincronizar(&nuvem, &local).await {
                Ok(r) if r.enviados + r.recebidos > 0 => {
                    eprintln!("sync: enviados={} recebidos={} orfas={}", r.enviados, r.recebidos, r.orfas);
                }
                Ok(_) => {}
                Err(e) => eprintln!("sync falhou (segue offline): {e}"),
            }
        }
        tokio::time::sleep(std::time::Duration::from_secs(120)).await;
    }
}
