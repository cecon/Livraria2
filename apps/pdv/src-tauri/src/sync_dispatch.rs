use crate::adapters::nuvem::{api_sync::ApiSync, supabase_sync::SupabaseSync};
use crate::adapters::persistencia::{api_replica::SeaApiReplica, replica_sync::SeaReplicaSync};
use crate::application::{api_sync::sincronizar_api, ports::RepoErro, sincronizacao};
use crate::application::sincronizacao::ResumoSync;
use crate::domain::sincronizacao::ORDEM_DEPENDENCIA;
use sea_orm::DatabaseConnection;
use std::path::Path;

static SYNC_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

pub async fn executar(db: &DatabaseConnection, config: Option<&Path>) -> Result<ResumoSync, RepoErro> {
    let _lock = SYNC_LOCK.try_lock().map_err(|_| RepoErro::Persistencia("Sincronizacao ja em andamento".into()))?;
    let local = SeaReplicaSync::new(db.clone());
    let legacy = SupabaseSync::conectar(config).await?;
    if std::env::var("NUVEM_API_ENABLED").as_deref() != Ok("true") {
        return sincronizacao::sincronizar(&legacy, &local).await;
    }
    // Explicit hybrid rollout: reference data/turns remain legacy. Never resend
    // API-owned sales through Supabase when the API fails.
    let recursos: Vec<&str> = ORDEM_DEPENDENCIA.iter().copied().filter(|r|
        !matches!(*r, "livro" | "pedido" | "item_pedido" | "pagamento_pedido")).collect();
    let mut summary = sincronizacao::sincronizar_recursos(&legacy, &local, &recursos).await?;
    let api = ApiSync::conectar().await?;
    let replica = SeaApiReplica { db: db.clone() };
    let result = sincronizar_api(&api, &replica).await?;
    summary.enviados += result.enviados;
    summary.recebidos += result.recebidos;
    Ok(summary)
}
