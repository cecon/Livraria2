//! Adapter de persistência: conexão SQLite (SeaORM) e aplicação das migrations.

pub mod dashboard_repo;
pub mod entities;
pub mod estoque_repo;
pub mod inventario_repo;
pub mod inventario_sql;
pub mod livro_repo;
pub mod pedido_repo;
pub mod relatorio_repo;
pub mod usuario_repo;

use crate::migration::Migrator;
use sea_orm::{Database, DatabaseConnection, DbErr};
use sea_orm_migration::MigratorTrait;

/// Conecta ao SQLite. `db_url` ex.: "sqlite://<caminho>/livraria.db?mode=rwc"
/// (`mode=rwc` cria o arquivo se não existir).
pub async fn conectar(db_url: &str) -> Result<DatabaseConnection, DbErr> {
    Database::connect(db_url).await
}

/// Aplica as migrations idempotentes (FR-061). Seguro re-executar.
pub async fn inicializar_schema(db: &DatabaseConnection) -> Result<(), DbErr> {
    Migrator::up(db, None).await
}
