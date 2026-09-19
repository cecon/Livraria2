use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};
pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    db.execute(Statement::from_string(db.get_database_backend(),
        "CREATE TABLE IF NOT EXISTS produto_importacao_pontual(uid TEXT PRIMARY KEY, versao TEXT NOT NULL)"))
        .await?;
    Ok(())
}
