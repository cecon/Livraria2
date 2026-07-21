//! Adapter de persistência: conexão SQLite (SeaORM) e aplicação das migrations.

pub mod dashboard_repo;
pub mod destinacao_repasse_sql;
pub mod destinacao_repo;
pub mod destinacao_sql;
pub mod entities;
pub mod estoque_repo;
pub mod estoque_sql;
pub mod forma_pagamento_repo;
pub mod fornecedor_repo;
pub mod inventario_relatorio_sql;
pub mod inventario_repo;
pub mod inventario_sql;
pub mod lancamento_repo;
pub mod lancamento_sql;
pub mod livro_repo;
pub mod pagamento_pedido_sql;
pub mod pedido_repo;
pub mod pedido_sql;
pub mod relatorio_repo;
pub mod usuario_repo;

pub mod replica_sync;

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
/// Após as migrations versionadas (002/003), aplica a **m004** (identidade do
/// livro, ADR-0012) e a **m006** (cadastro de formas de pagamento, ADR-0013),
/// idempotentes por estado. Um `Err` aqui DEVE bloquear o boot para operação
/// (FR-016a): a migração já sofreu rollback e os dados originais estão intactos.
pub async fn inicializar_schema(db: &DatabaseConnection) -> Result<(), DbErr> {
    Migrator::up(db, None).await?;
    if let Some(rel) = crate::migration::m004::aplicar(db).await? {
        if rel.total_orfaos() > 0 {
            eprintln!(
                "m004: migrado (livros={}); órfãs descartadas → mov={} contagem={} lancamento={}",
                rel.livros, rel.mov_orfaos, rel.contagem_orfaos, rel.lancamento_orfaos
            );
        }
    }
    if let Some(rel) = crate::migration::m006::aplicar(db).await? {
        eprintln!(
            "m006: formas de pagamento migradas (formas={}, pedidos={}, linhas={}, soma={})",
            rel.formas_semeadas, rel.pedidos, rel.linhas_pagamento, rel.soma_total_centavos
        );
    }
    // m008 (feature 007): colunas de sincronização com a nuvem (ADR-0015/0016),
    // aditiva e idempotente, aplicada contra o schema final.
    crate::migration::m008::aplicar(db).await?;
    Ok(())
}
