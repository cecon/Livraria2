//! m010 (feature 010): coluna `usuario.perfil` (`operador` | `admin`) — controle de
//! acesso por perfil (ADR-0019). O perfil **sincroniza** para o PDV (não é segredo).
//!
//! Idempotente (Princípio IV): ignora "duplicate column" ao re-aplicar; o backfill do
//! `adm` → admin é condicional (`WHERE usuario='adm'`). Padrão da m008.

use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

async fn exec(db: &DatabaseConnection, sql: String) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    db.execute(Statement::from_string(backend, sql)).await.map(|_| ())
}

/// ALTER ADD COLUMN idempotente (SQLite não tem `IF NOT EXISTS` p/ coluna).
async fn add_coluna(db: &DatabaseConnection, tabela: &str, coluna_def: &str) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    let sql = format!("ALTER TABLE {tabela} ADD COLUMN {coluna_def}");
    if let Err(e) = db.execute(Statement::from_string(backend, sql)).await {
        if !e.to_string().to_lowercase().contains("duplicate column") {
            return Err(e);
        }
    }
    Ok(())
}

/// Aplica a m010. Novos usuários entram como `operador` (menor privilégio); o `adm`
/// padrão do sistema é promovido a `admin`. Re-executar não duplica nem perde dados.
pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    add_coluna(db, "usuario", "perfil TEXT NOT NULL DEFAULT 'operador'").await?;
    exec(db, "UPDATE usuario SET perfil='admin' WHERE usuario='adm'".to_string()).await?;
    Ok(())
}
