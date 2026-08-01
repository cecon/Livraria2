//! m013 (feature 012, "a nuvem manda"): drop das tabelas locais de inventário
//! (sessão + contagem). O inventário saiu do PDV (vive só na nuvem/escritório).
//! Idempotente (DROP IF EXISTS; filha antes da pai).

use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    for sql in [
        "DROP TABLE IF EXISTS item_contagem",
        "DROP TABLE IF EXISTS sessao_inventario",
    ] {
        db.execute(Statement::from_string(backend, sql.to_string())).await?;
    }
    Ok(())
}
