//! m013 (feature 012, "a nuvem manda"): drop das tabelas locais de inventário. O
//! inventário saiu do PDV (vive só na nuvem/escritório). Idempotente (DROP IF
//! EXISTS). Ordem filha→pai OBRIGATÓRIA: com `foreign_keys=ON` (default do sqlx),
//! `DROP` faz um DELETE implícito, e `sessao_inventario` é referenciada por DUAS
//! filhas — `item_contagem` E `pendencia_cadastro`. Dropar a pai antes de ambas
//! dispara `(787) FOREIGN KEY constraint failed` em bases de produção com dados
//! históricos (incidente v26.8.1).

use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    for sql in [
        "DROP TABLE IF EXISTS item_contagem",
        "DROP TABLE IF EXISTS pendencia_cadastro",
        "DROP TABLE IF EXISTS sessao_inventario",
    ] {
        db.execute(Statement::from_string(backend, sql.to_string())).await?;
    }
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use sea_orm::Database;

    async fn exec(db: &DatabaseConnection, sql: &str) {
        db.execute(Statement::from_string(db.get_database_backend(), sql.to_string()))
            .await
            .unwrap();
    }

    /// Reproduz o incidente v26.8.1: base "de produção" com as tabelas de
    /// inventário e `foreign_keys=ON`, onde `pendencia_cadastro` referencia
    /// `sessao_inventario`. O m013 deve dropar o cluster sem violar FK (787).
    #[tokio::test]
    async fn dropa_cluster_de_inventario_com_fk_on() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        exec(&db, "PRAGMA foreign_keys = ON").await;
        // Esquema legado (pai + duas filhas com FK), como em produção.
        exec(&db, "CREATE TABLE sessao_inventario (id INTEGER PRIMARY KEY AUTOINCREMENT)").await;
        exec(
            &db,
            "CREATE TABLE item_contagem (id INTEGER PRIMARY KEY, \
             sessao_id INTEGER NOT NULL REFERENCES sessao_inventario(id))",
        )
        .await;
        exec(
            &db,
            "CREATE TABLE pendencia_cadastro (id INTEGER PRIMARY KEY, \
             sessao_id INTEGER REFERENCES sessao_inventario(id))",
        )
        .await;
        // Dados históricos que referenciam a pai (o que dispara o 787 no drop errado).
        exec(&db, "INSERT INTO sessao_inventario (id) VALUES (1)").await;
        exec(&db, "INSERT INTO item_contagem (id, sessao_id) VALUES (1, 1)").await;
        exec(&db, "INSERT INTO pendencia_cadastro (id, sessao_id) VALUES (1, 1)").await;

        // NÃO deve estourar FOREIGN KEY constraint failed.
        aplicar(&db).await.expect("m013 deve dropar o cluster sem violar FK");

        // Idempotente: re-aplicar num banco já limpo é no-op.
        aplicar(&db).await.expect("m013 idempotente");

        // Tabelas sumiram.
        let rows = db
            .query_all(Statement::from_string(
                db.get_database_backend(),
                "SELECT name FROM sqlite_master WHERE type='table' \
                 AND name IN ('sessao_inventario','item_contagem','pendencia_cadastro')"
                    .to_string(),
            ))
            .await
            .unwrap();
        assert!(rows.is_empty(), "cluster de inventário deve ter sido removido");
    }
}
