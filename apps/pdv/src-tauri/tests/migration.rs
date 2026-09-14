//! Teste de integração: a migration cria o schema e é idempotente (FR-061, SC-005).

use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use sea_orm::{ConnectionTrait, Statement};

fn url_temp() -> (String, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("livraria_mig_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

#[tokio::test]
async fn schema_inicializa_e_e_idempotente() {
    let (url, path) = url_temp();
    let db = conectar(&url).await.expect("conectar");

    // Primeira aplicação cria o schema.
    inicializar_schema(&db).await.expect("1a migração");
    // Segunda aplicação não pode falhar nem duplicar (idempotência).
    inicializar_schema(&db).await.expect("2a migração (idempotente)");

    // As 4 tabelas de domínio existem.
    let backend = db.get_database_backend();
    for tabela in ["livro", "pedido", "item_pedido", "usuario"] {
        let sql = format!(
            "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='{}'",
            tabela
        );
        let row = db
            .query_one(Statement::from_string(backend, sql))
            .await
            .expect("query")
            .expect("uma linha");
        let n: i32 = row.try_get("", "n").expect("coluna n");
        assert_eq!(n, 1, "tabela {} deve existir", tabela);
    }

    let _ = std::fs::remove_file(&path);
}
