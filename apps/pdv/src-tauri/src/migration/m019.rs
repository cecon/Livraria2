use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    for sql in [
        "CREATE TABLE IF NOT EXISTS produto_capa(produto_uid TEXT PRIMARY KEY, capa_uid TEXT, versao TEXT NOT NULL DEFAULT '0')",
        "CREATE INDEX IF NOT EXISTS idx_produto_capa_uid ON produto_capa(capa_uid)",
        "CREATE TABLE IF NOT EXISTS capa_tentativa(uid TEXT PRIMARY KEY, tentada_em TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS capa_cache(uid TEXT PRIMARY KEY, imagem TEXT NOT NULL)",
    ] {
        db.execute(Statement::from_string(db.get_database_backend(), sql)).await?;
    }
    Ok(())
}
