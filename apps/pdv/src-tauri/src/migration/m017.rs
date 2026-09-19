use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    let cols = db.query_all(Statement::from_string(backend,
        "PRAGMA table_info(caixa_movimento)".to_string())).await?;
    if !cols.iter().any(|r| r.try_get::<String>("", "name").ok().as_deref() == Some("sincronizado_em")) {
        db.execute(Statement::from_string(backend,
            "ALTER TABLE caixa_movimento ADD COLUMN sincronizado_em TEXT".to_string())).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::Database;

    #[tokio::test]
    async fn adiciona_confirmacao_de_movimento_sem_apagar_historico() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        crate::adapters::persistencia::inicializar_schema(&db).await.unwrap();
        aplicar(&db).await.unwrap();
        let columns = db.query_all(Statement::from_string(db.get_database_backend(),
            "PRAGMA table_info(caixa_movimento)")).await.unwrap();
        assert!(columns.iter().any(|row| row.try_get::<String>("", "name").ok().as_deref() == Some("sincronizado_em")));
    }
}
