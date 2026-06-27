//! Adapter de persistência: conexão SQLite (SeaORM) e aplicação das migrations.

pub mod dashboard_repo;
pub mod entities;
pub mod estoque_repo;
pub mod estoque_sql;
pub mod fornecedor_repo;
pub mod inventario_repo;
pub mod inventario_sql;
pub mod lancamento_repo;
pub mod lancamento_sql;
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
///
/// NOTA (US1, em andamento): a **m004** (identidade do livro — `id` PK, `codigo`
/// único, remoção de `codigo_barras`, FKs→`livro_id`, ADR-0012) já está
/// implementada e testada em `crate::migration::m004`, mas **ainda não é aplicada
/// aqui** porque depende do refactor das entidades/repos (T007–T019). A ativação
/// (`crate::migration::m004::aplicar(db)`) entra junto com esse refactor.
pub async fn inicializar_schema(db: &DatabaseConnection) -> Result<(), DbErr> {
    Migrator::up(db, None).await
}
