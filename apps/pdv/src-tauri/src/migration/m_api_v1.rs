use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    let cols = db.query_all(Statement::from_string(backend, "PRAGMA table_info(item_pedido)".to_string())).await?;
    if !cols.iter().any(|r| r.try_get::<String>("", "name").ok().as_deref() == Some("livro_uid")) {
        db.execute(Statement::from_string(backend, "ALTER TABLE item_pedido ADD COLUMN livro_uid TEXT".to_string())).await?;
    }
    db.execute(Statement::from_string(backend,
        "UPDATE item_pedido SET livro_uid=(SELECT sync_uid FROM livro WHERE codigo=item_pedido.codigo)
         WHERE livro_uid IS NULL".to_string())).await?;
    db.execute(Statement::from_string(db.get_database_backend(),
        "CREATE TABLE IF NOT EXISTS nuvem_api_outbox (
          chave TEXT PRIMARY KEY, pedido_uid TEXT NOT NULL, cancelamento INTEGER NOT NULL,
          corpo TEXT NOT NULL, enviada INTEGER NOT NULL DEFAULT 0
        )".to_string())).await?;
    Ok(())
}
