use crate::application::api_sync::{EnvioApi, PaginaApi, ReplicaApi};
use crate::application::ports::RepoErro;
use async_trait::async_trait;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};
use serde_json::Value;

pub struct SeaApiReplica { pub db: DatabaseConnection }

pub(crate) fn erro(error: impl std::fmt::Display) -> RepoErro {
    RepoErro::Persistencia(error.to_string())
}

#[async_trait]
impl ReplicaApi for SeaApiReplica {
    async fn preparar_envios(&self) -> Result<(), RepoErro> {
        super::api_outbox::preparar(&self.db).await
    }
    async fn envios(&self) -> Result<Vec<EnvioApi>, RepoErro> {
        super::api_outbox::pendentes(&self.db).await
    }
    async fn confirmar_envio(&self, envio: &EnvioApi, resposta: &Value) -> Result<(), RepoErro> {
        super::api_outbox::confirmar(&self.db, envio, resposta).await
    }
    async fn cursor(&self) -> Result<String, RepoErro> {
        let row = self.db.query_one(Statement::from_string(self.db.get_database_backend(),
            "SELECT last_cursor FROM sync_cursor WHERE recurso='api_catalogo_v1'".to_string())).await.map_err(erro)?;
        Ok(row.and_then(|r| r.try_get::<String>("", "last_cursor").ok()).unwrap_or_else(|| "0".into()))
    }
    async fn aplicar_pagina(&self, pagina: &PaginaApi) -> Result<(), RepoErro> {
        super::api_catalogo::aplicar(&self.db, pagina).await
    }
}
