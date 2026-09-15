//! Normaliza identificadores de usuario para minusculas no SQLite local.

use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement, TransactionTrait};

pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    let tx = db.begin().await?;
    let backend = tx.get_database_backend();
    let collisions = tx.query_all(Statement::from_string(backend,
        "SELECT lower(trim(usuario)) AS usuario FROM usuario \
         GROUP BY lower(trim(usuario)) HAVING count(*) > 1 LIMIT 1".to_string())).await?;
    if let Some(row) = collisions.first() {
        let usuario: String = row.try_get("", "usuario")?;
        return Err(DbErr::Custom(format!("usuarios duplicados ao ignorar maiusculas: {usuario}")));
    }
    for sql in [
        "UPDATE pedido SET operador=lower(trim(operador)) WHERE operador IS NOT NULL",
        "UPDATE turno_operacao SET operador=lower(trim(operador)) WHERE operador IS NOT NULL",
        "UPDATE usuario SET usuario=lower(trim(usuario)) WHERE usuario<>lower(trim(usuario))",
    ] {
        tx.execute(Statement::from_string(backend, sql.to_string())).await?;
    }
    tx.commit().await
}

#[cfg(test)]
mod testes {
    use super::*;
    use sea_orm::Database;

    async fn exec(db: &DatabaseConnection, sql: &str) {
        db.execute(Statement::from_string(db.get_database_backend(), sql.to_string())).await.unwrap();
    }

    #[tokio::test]
    async fn normaliza_usuario_e_referencias_sem_perder_identidade() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        exec(&db, "CREATE TABLE usuario(usuario TEXT PRIMARY KEY)").await;
        exec(&db, "CREATE TABLE pedido(operador TEXT)").await;
        exec(&db, "CREATE TABLE turno_operacao(operador TEXT)").await;
        exec(&db, "INSERT INTO usuario VALUES('Maria.SILVA')").await;
        exec(&db, "INSERT INTO pedido VALUES('Maria.SILVA')").await;
        exec(&db, "INSERT INTO turno_operacao VALUES('Maria.SILVA')").await;
        aplicar(&db).await.unwrap();
        aplicar(&db).await.unwrap();
        for table in ["usuario", "pedido", "turno_operacao"] {
            let column = if table == "usuario" { "usuario" } else { "operador" };
            let rows = db.query_all(Statement::from_string(db.get_database_backend(),
                format!("SELECT {column} AS valor FROM {table}"))).await.unwrap();
            let value: String = rows[0].try_get("", "valor").unwrap();
            assert_eq!(value, "maria.silva");
        }
    }

    #[tokio::test]
    async fn colisao_interrompe_sem_alterar_dados() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        exec(&db, "CREATE TABLE usuario(usuario TEXT PRIMARY KEY)").await;
        exec(&db, "CREATE TABLE pedido(operador TEXT)").await;
        exec(&db, "CREATE TABLE turno_operacao(operador TEXT)").await;
        exec(&db, "INSERT INTO usuario VALUES('Joao'),('joao')").await;
        assert!(aplicar(&db).await.is_err());
        let rows = db.query_all(Statement::from_string(db.get_database_backend(),
            "SELECT usuario FROM usuario ORDER BY usuario".to_string())).await.unwrap();
        assert_eq!(rows.len(), 2);
    }
}
