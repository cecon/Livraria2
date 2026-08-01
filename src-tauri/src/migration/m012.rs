//! m012 (feature 012, "a nuvem manda"): drop das tabelas locais de lançamento de
//! nota. A entrada de nota saiu do PDV (vive só na nuvem/escritório); o histórico
//! fica na nuvem. Idempotente (DROP IF EXISTS; filha antes da pai).

use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    for sql in [
        "DROP TABLE IF EXISTS item_lancamento",
        "DROP TABLE IF EXISTS lancamento_entrada",
    ] {
        db.execute(Statement::from_string(backend, sql.to_string())).await?;
    }
    Ok(())
}
