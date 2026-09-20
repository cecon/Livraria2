use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

/// Reject damaged files before schema migrations attempt any write.
pub async fn verificar(db: &DatabaseConnection) -> Result<(), DbErr> {
    let rows = db.query_all(Statement::from_string(db.get_database_backend(),
        "PRAGMA quick_check".to_string())).await.map_err(|_| falha())?;
    if rows.len() != 1 || rows[0].try_get::<String>("", "quick_check")
        .map_err(|_| falha())? != "ok" {
        return Err(falha());
    }
    Ok(())
}

fn falha() -> DbErr {
    DbErr::Custom("O arquivo de dados local não passou na verificação de integridade. As migrações não foram iniciadas. Preserve o banco e solicite recuperação ao suporte.".into())
}
