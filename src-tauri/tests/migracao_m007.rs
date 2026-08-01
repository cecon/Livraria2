//! Teste de integração da m007 (destinações — ADR-0014): cria as 4 tabelas,
//! semeia "Loja" (de_sistema=1) e é idempotente (re-aplicar não duplica o seed).

use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use sea_orm::{ConnectionTrait, Statement};

fn url_temp() -> (String, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("livraria_m007_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

async fn conta(db: &sea_orm::DatabaseConnection, sql: &str) -> i32 {
    let row = db
        .query_one(Statement::from_string(db.get_database_backend(), sql.to_string()))
        .await
        .expect("query")
        .expect("uma linha");
    row.try_get("", "n").expect("coluna n")
}

#[tokio::test]
async fn m007_cria_tabelas_sem_semear_loja() {
    let (url, path) = url_temp();
    let db = conectar(&url).await.expect("conectar");

    inicializar_schema(&db).await.expect("1a migração");
    inicializar_schema(&db).await.expect("2a migração (idempotente)");

    for tabela in [
        "destinacao",
        "destinacao_saldo",
        "transferencia_destinacao",
        "alocacao_venda",
    ] {
        let n = conta(
            &db,
            &format!(
                "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='{tabela}'"
            ),
        )
        .await;
        assert_eq!(n, 1, "tabela {tabela} deve existir");
    }

    // Feature 012 ("a nuvem manda"): a m007 NÃO semeia mais a "Loja". Num install
    // limpo a destinação de sistema desce da nuvem no 1º sync (pull-only, US2).
    // Re-aplicar as sentenças da m007 continua idempotente (não cria destinação).
    for sql in livraria_2_lib::migration::m007_sql() {
        db.execute(Statement::from_string(
            db.get_database_backend(),
            sql.to_string(),
        ))
        .await
        .expect("re-aplicar sentença da m007");
    }
    let seed = conta(&db, "SELECT count(*) AS n FROM destinacao WHERE de_sistema = 1").await;
    assert_eq!(seed, 0, "m007 não semeia destinação de sistema (vem da nuvem)");

    let _ = std::fs::remove_file(&path);
}
