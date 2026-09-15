use crate::adapters::nuvem::{api_sync::ApiSync, supabase_sync::SupabaseSync};
use crate::adapters::persistencia::{api_replica::SeaApiReplica, replica_sync::SeaReplicaSync};
use crate::application::{api_sync::sincronizar_api, ports::RepoErro, sincronizacao};
use crate::application::sincronizacao::ResumoSync;
use crate::domain::sincronizacao::ORDEM_DEPENDENCIA;
use sea_orm::DatabaseConnection;
use std::path::Path;

static SYNC_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

pub async fn executar(
    db: &DatabaseConnection,
    legacy_config: Option<&Path>,
    machine_config: Option<&Path>,
) -> Result<ResumoSync, RepoErro> {
    let _lock = SYNC_LOCK.try_lock().map_err(|_| RepoErro::Persistencia("Sincronizacao ja em andamento".into()))?;
    let local = SeaReplicaSync::new(db.clone());
    if !crate::machine_config::is_configured(machine_config) {
        let legacy = SupabaseSync::conectar(legacy_config).await?;
        return sincronizacao::sincronizar(&legacy, &local).await;
    }
    let api = ApiSync::conectar_com_config(machine_config).await?;
    let replica = SeaApiReplica { db: db.clone() };
    let result = sincronizar_api(&api, &replica).await?;
    let mut summary = ResumoSync {
        enviados: result.enviados,
        recebidos: result.recebidos,
        orfas: 0,
    };
    // Na transicao, referencia e turnos ainda podem vir do legado. A ausencia
    // dessa configuracao nao pode impedir catalogo e vendas da API nova.
    if let Ok(legacy) = SupabaseSync::conectar(legacy_config).await {
        let recursos: Vec<&str> = ORDEM_DEPENDENCIA.iter().copied().filter(|r|
            !matches!(*r, "livro" | "pedido" | "item_pedido" | "pagamento_pedido")).collect();
        if let Ok(r) = sincronizacao::sincronizar_recursos(&legacy, &local, &recursos).await {
            summary.enviados += r.enviados;
            summary.recebidos += r.recebidos;
            summary.orfas += r.orfas;
        }
    }
    Ok(summary)
}
