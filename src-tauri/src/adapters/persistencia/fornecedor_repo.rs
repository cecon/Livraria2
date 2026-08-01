//! Implementação SeaORM da porta `FornecedorRepo` (ADR-0011). Feature 012: o
//! cadastro de fornecedor vive na nuvem; o PDV só SEMEIA (boot) a partir dos
//! textos históricos de `movimento_estoque.fornecedor`, para o sync empurrar.

use super::entities::fornecedor::{self, ActiveModel, Entity as FornecedorEntity};
use crate::application::ports::RepoErro;
use crate::application::ports_compras::FornecedorRepo;
use crate::domain::texto::normalize;
use async_trait::async_trait;
use sea_orm::sea_query::OnConflict;
use sea_orm::{
    ActiveValue::{NotSet, Set},
    ConnectionTrait, DatabaseConnection, DbErr, EntityTrait, Statement,
};

pub struct SeaFornecedorRepo {
    db: DatabaseConnection,
}

impl SeaFornecedorRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

#[async_trait]
impl FornecedorRepo for SeaFornecedorRepo {
    async fn semear(&self) -> Result<u64, RepoErro> {
        let backend = self.db.get_database_backend();
        let rows = self
            .db
            .query_all(Statement::from_string(
                backend,
                "SELECT DISTINCT fornecedor AS nome FROM movimento_estoque
                 WHERE fornecedor IS NOT NULL AND fornecedor <> ''"
                    .to_string(),
            ))
            .await
            .map_err(erro)?;
        let mut criados = 0u64;
        for r in &rows {
            let nome: String = r.try_get("", "nome").map_err(erro)?;
            // Insere ignorando se o nome_norm já existe (idempotente, FR-005).
            let res = FornecedorEntity::insert(ActiveModel {
                id: NotSet,
                nome: Set(nome.clone()),
                nome_norm: Set(normalize(&nome)),
                documento: Set(None),
                telefone: Set(None),
                email: Set(None),
                observacoes: Set(None),
                ativo: Set(true),
            })
            .on_conflict(
                OnConflict::column(fornecedor::Column::NomeNorm)
                    .do_nothing()
                    .to_owned(),
            )
            .exec(&self.db)
            .await;
            if res.is_ok() {
                criados += 1;
            }
        }
        Ok(criados)
    }
}
