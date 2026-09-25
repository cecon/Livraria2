use crate::adapters::nuvem::api_sync::ApiSync;
use crate::adapters::persistencia::{api_replica::SeaApiReplica, api_referencias};
use crate::application::{api_sync::{sincronizar_api, ResumoSync}, ports::RepoErro};
use sea_orm::DatabaseConnection;
use std::path::Path;
static SYNC_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
static SYNC_NOTIFY: tokio::sync::Notify = tokio::sync::Notify::const_new();
pub fn request_now() { SYNC_NOTIFY.notify_one(); }
pub async fn wait_request() { SYNC_NOTIFY.notified().await; }
pub async fn executar(db: &DatabaseConnection, machine_config: Option<&Path>) -> Result<ResumoSync, RepoErro> {
    let _lock = SYNC_LOCK.try_lock().map_err(|_| RepoErro::Persistencia("Sincronizacao ja em andamento".into()))?;
    let api = ApiSync::conectar_com_config(machine_config).await?;
    let machine_uid = crate::machine_config::identity(machine_config).map_err(RepoErro::Persistencia)?.pdv_uid;
    let mut recebidos = 0;
    for recurso in ["usuario", "forma_pagamento", "destinacao"] {
        let mut after = String::new();
        loop {
            let pagina = api.referencias(recurso, &after).await?;
            api_referencias::aplicar(db, recurso, &pagina.registros).await?;
            recebidos += pagina.registros.len();
            match pagina.proximo {
                Some(next) if next > after => after = next,
                None => break,
                _ => return Err(RepoErro::Persistencia("Paginacao de referencias invalida".into())),
            }
        }
    }
    let opened = crate::shift_sync::send_open(db, &api, &machine_uid).await?;
    let movements = crate::cash_sync::send(db, &api, &machine_uid).await?;
    let replica = SeaApiReplica { db: db.clone() };
    let result = sincronizar_api(&api, &replica).await?;
    let closed = crate::shift_sync::send_closed(db, &api, &machine_uid).await?;
    Ok(ResumoSync { enviados: result.enviados + opened + closed + movements,
        recebidos: result.recebidos + recebidos, orfas: 0 })
}
