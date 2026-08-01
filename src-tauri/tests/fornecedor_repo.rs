//! Teste de integração do FornecedorRepo (T011). Feature 012: o cadastro vive na
//! nuvem; o PDV só SEMEIA (idempotente) a partir de `movimento_estoque.fornecedor`.

use livraria_2_lib::adapters::persistencia::fornecedor_repo::SeaFornecedorRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports_compras::FornecedorRepo;
use sea_orm::{ConnectionTrait, Statement};

fn url_temp() -> (String, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("livraria_forn_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

async fn conta(db: &sea_orm::DatabaseConnection, nome_norm: &str) -> i64 {
    let row = db
        .query_one(Statement::from_sql_and_values(
            db.get_database_backend(),
            "SELECT COUNT(*) AS n FROM fornecedor WHERE nome_norm = ?",
            [nome_norm.into()],
        ))
        .await
        .unwrap()
        .unwrap();
    row.try_get::<i64>("", "n").unwrap()
}

#[tokio::test]
async fn semear_dedup_e_idempotente() {
    let (url, path) = url_temp();
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let repo = SeaFornecedorRepo::new(db.clone());

    // Movimentos com fornecedores distintos (um repetido) alimentam o semear.
    db.execute(Statement::from_string(
        db.get_database_backend(),
        "INSERT INTO livro (codigo, titulo, preco_centavos, categoria, estoque, busca_norm, ativo, atualizado_em, custo_medio_centavos)
         VALUES ('x', 'X', 0, 0, 0, '', 1, '', 0)"
            .to_string(),
    ))
    .await
    .unwrap();
    for nome in ["Editora Vida", "Editora Vida", "EDITORA SBB"] {
        db.execute(Statement::from_sql_and_values(
            db.get_database_backend(),
            "INSERT INTO movimento_estoque (livro_id, tipo, qtd, fornecedor, criado_em)
             VALUES ((SELECT id FROM livro WHERE codigo = 'x'), 'entrada', 1, ?, '')",
            [nome.into()],
        ))
        .await
        .unwrap();
    }

    let criados = repo.semear().await.unwrap();
    assert_eq!(criados, 2); // "Editora Vida" e "EDITORA SBB" (distintos)
    // Idempotente: re-semear não cria de novo, e não duplica o nome_norm.
    assert_eq!(repo.semear().await.unwrap(), 0);
    assert_eq!(conta(&db, "editora vida").await, 1);

    let _ = std::fs::remove_file(&path);
}
