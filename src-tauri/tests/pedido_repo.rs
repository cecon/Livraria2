//! Regressão: excluir venda/item devolve o estoque (estorno no ledger).

use livraria_2_lib::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports::PedidoRepo;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};

fn url_temp(tag: &str) -> (String, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("livraria_ped_{}_{tag}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

async fn run(db: &DatabaseConnection, sql: &str) {
    db.execute(Statement::from_string(db.get_database_backend(), sql.to_string()))
        .await
        .unwrap();
}

async fn n(db: &DatabaseConnection, sql: &str) -> i64 {
    db.query_one(Statement::from_string(db.get_database_backend(), sql.to_string()))
        .await
        .unwrap()
        .unwrap()
        .try_get::<i64>("", "n")
        .unwrap()
}

async fn estoque(db: &DatabaseConnection, codigo: &str) -> i64 {
    n(db, &format!("SELECT estoque AS n FROM livro WHERE codigo = '{codigo}'")).await
}

/// Simula uma venda crua (pedido + item + saldo_inicial + saida_venda) baixando o estoque.
async fn semear_venda(db: &DatabaseConnection, numero: i64, codigo: &str, inicial: i64, baixa: i64) {
    run(db, &format!(
        "INSERT INTO livro (codigo, titulo, busca_norm, estoque) VALUES ('{codigo}','{codigo}','{codigo}', 0)"
    )).await;
    run(db, &format!(
        "INSERT INTO movimento_estoque (livro_id, tipo, qtd, criado_em)
         VALUES ((SELECT id FROM livro WHERE codigo='{codigo}'),'saldo_inicial',{inicial},'2026-06-27')"
    )).await;
    run(db, &format!(
        "INSERT INTO pedido (numero, cliente, turno, data, total_centavos) VALUES ({numero},'C','manha','2026-06-27',1000)"
    )).await;
    run(db, &format!(
        "INSERT INTO item_pedido (pedido_numero, codigo, titulo, preco_centavos, qtd) VALUES ({numero},'{codigo}','{codigo}',1000,{baixa})"
    )).await;
    run(db, &format!(
        "INSERT INTO movimento_estoque (livro_id, tipo, qtd, referencia, criado_em)
         VALUES ((SELECT id FROM livro WHERE codigo='{codigo}'),'saida_venda',{},'{numero}','2026-06-27')",
        -baixa
    )).await;
    run(db, &format!("UPDATE livro SET estoque = {} WHERE codigo='{codigo}'", inicial - baixa)).await;
}

async fn soma_mov(db: &DatabaseConnection, codigo: &str) -> i64 {
    n(db, &format!(
        "SELECT COALESCE(SUM(qtd),0) AS n FROM movimento_estoque WHERE livro_id=(SELECT id FROM livro WHERE codigo='{codigo}')"
    )).await
}

#[tokio::test]
async fn excluir_pedido_devolve_estoque() {
    let (url, path) = url_temp("pedido");
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    semear_venda(&db, 50, "L1", 10, 3).await;
    assert_eq!(estoque(&db, "L1").await, 7); // 10 - 3
    assert_eq!(soma_mov(&db, "L1").await, 7); // invariante Σ == estoque

    SeaPedidoRepo::new(db.clone()).excluir_pedido(50).await.unwrap();

    assert_eq!(estoque(&db, "L1").await, 10); // estoque devolvido
    assert_eq!(soma_mov(&db, "L1").await, 10); // invariante mantida (saldo +10, saída -3, estorno +3)
    // gerou um movimento de estorno
    assert_eq!(
        n(&db, "SELECT count(*) AS n FROM movimento_estoque WHERE tipo='estorno' AND referencia='50'").await,
        1
    );
    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn excluir_item_devolve_estoque() {
    let (url, path) = url_temp("item");
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    semear_venda(&db, 60, "L2", 8, 2).await;
    assert_eq!(estoque(&db, "L2").await, 6);

    let item_id = n(&db, "SELECT id AS n FROM item_pedido WHERE pedido_numero=60").await;
    SeaPedidoRepo::new(db.clone()).excluir_item(item_id).await.unwrap();

    assert_eq!(estoque(&db, "L2").await, 8); // devolvido
    let _ = std::fs::remove_file(&path);
}
