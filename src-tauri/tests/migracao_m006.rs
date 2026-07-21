//! Testes da m006 (ADR-0013): backfill val_* → pagamento_pedido sem perda (Σ por
//! venda e por forma), idempotência, base vazia, esparso e falha com rollback.

use livraria_2_lib::migration::m006;
use sea_orm::{ConnectionTrait, Database, DatabaseConnection, Statement};

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

/// Base ANTIGA (pré-m006): `pedido` com colunas val_* (como a m_init criava).
async fn base_antiga(tag: &str) -> (DatabaseConnection, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("livraria_m006_{}_{tag}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    let db = Database::connect(format!("sqlite://{}?mode=rwc", path.display()))
        .await
        .unwrap();
    run(&db, "CREATE TABLE pedido (
        numero INTEGER PRIMARY KEY,
        cliente TEXT NOT NULL DEFAULT 'CLIENTE',
        turno TEXT NOT NULL,
        data TEXT NOT NULL,
        total_centavos INTEGER NOT NULL,
        val_cartao INTEGER NOT NULL DEFAULT 0,
        val_dinheiro INTEGER NOT NULL DEFAULT 0,
        val_pix INTEGER NOT NULL DEFAULT 0,
        val_ministerio INTEGER NOT NULL DEFAULT 0,
        val_vale INTEGER NOT NULL DEFAULT 0,
        cancelado INTEGER NOT NULL DEFAULT 0,
        cancelado_em TEXT
    )")
    .await;
    run(&db, "CREATE TABLE item_pedido (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedido_numero INTEGER NOT NULL REFERENCES pedido(numero),
        codigo TEXT NOT NULL,
        titulo TEXT NOT NULL,
        preco_centavos INTEGER NOT NULL,
        qtd INTEGER NOT NULL
    )")
    .await;
    (db, path)
}

async fn semear_vendas(db: &DatabaseConnection) {
    // Venda 1: cartão + dinheiro; venda 2: pix + ministério; venda 3: zerada (esparsa).
    run(db, "INSERT INTO pedido (numero,cliente,turno,data,total_centavos,val_cartao,val_dinheiro,val_pix,val_ministerio,val_vale)
        VALUES (1,'A','manha','2026-06-01',10000,6000,4000,0,0,0),
               (2,'B','tarde','2026-06-02',3500,0,0,2500,1000,0),
               (3,'C','manha','2026-06-03',0,0,0,0,0,0)").await;
    run(db, "INSERT INTO item_pedido (pedido_numero,codigo,titulo,preco_centavos,qtd)
        VALUES (1,'111','Livro A',5000,2), (2,'222','Livro B',3500,1)").await;
}

#[tokio::test]
async fn backfill_preserva_somas_por_venda_e_por_forma() {
    let (db, path) = base_antiga("somas").await;
    semear_vendas(&db).await;

    let rel = m006::aplicar(&db).await.unwrap().expect("deve migrar");
    assert_eq!(rel.formas_semeadas, 7);
    assert_eq!(rel.pedidos, 3);
    assert_eq!(rel.linhas_pagamento, 4, "esparso: só val_* > 0 vira linha");
    assert_eq!(rel.soma_total_centavos, 13500);

    // Σ por venda preservada; "Cartão" agora pertence a Crédito (FR-003).
    assert_eq!(n(&db, "SELECT COALESCE(SUM(valor_centavos),0) AS n FROM pagamento_pedido WHERE pedido_numero=1").await, 10000);
    assert_eq!(n(&db, "SELECT valor_centavos AS n FROM pagamento_pedido pp JOIN forma_pagamento f ON f.id=pp.forma_id WHERE pp.pedido_numero=1 AND f.chave='credito'").await, 6000);
    assert_eq!(n(&db, "SELECT valor_centavos AS n FROM pagamento_pedido pp JOIN forma_pagamento f ON f.id=pp.forma_id WHERE pp.pedido_numero=2 AND f.chave='ministerio'").await, 1000);
    // Venda zerada não cria linhas e não quebra a verificação.
    assert_eq!(n(&db, "SELECT count(*) AS n FROM pagamento_pedido WHERE pedido_numero=3").await, 0);

    // Colunas val_* removidas do pedido (rebuild).
    let cols = db
        .query_all(Statement::from_string(
            db.get_database_backend(),
            "PRAGMA table_info(pedido)".to_string(),
        ))
        .await
        .unwrap();
    assert!(cols.iter().all(|r| r.try_get::<String>("", "name").unwrap() != "val_cartao"));
    // Itens preservados no rebuild (rename reescreve a FK para `pedido`).
    assert_eq!(n(&db, "SELECT count(*) AS n FROM item_pedido").await, 2);

    // Seed: 7 formas, todas ativas, flags de sistema (FR-002/FR-001a).
    assert_eq!(n(&db, "SELECT count(*) AS n FROM forma_pagamento WHERE ativa=1").await, 7);
    assert_eq!(n(&db, "SELECT count(*) AS n FROM forma_pagamento WHERE de_sistema=1").await, 5);
    assert_eq!(n(&db, "SELECT count(*) AS n FROM forma_pagamento WHERE chave IN ('debito','pix_igreja') AND de_sistema=0").await, 2);

    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn reaplicar_e_noop_idempotente() {
    let (db, path) = base_antiga("idem").await;
    semear_vendas(&db).await;

    assert!(m006::aplicar(&db).await.unwrap().is_some());
    let linhas_antes = n(&db, "SELECT count(*) AS n FROM pagamento_pedido").await;
    let soma_antes = n(&db, "SELECT COALESCE(SUM(valor_centavos),0) AS n FROM pagamento_pedido").await;

    // Reaplicar (reabertura do app): no-op, nada duplica (FR-016/SC-003).
    assert!(m006::aplicar(&db).await.unwrap().is_none());
    assert_eq!(n(&db, "SELECT count(*) AS n FROM pagamento_pedido").await, linhas_antes);
    assert_eq!(n(&db, "SELECT COALESCE(SUM(valor_centavos),0) AS n FROM pagamento_pedido").await, soma_antes);

    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn base_vazia_converge() {
    let (db, path) = base_antiga("vazia").await;
    let rel = m006::aplicar(&db).await.unwrap().expect("deve migrar");
    assert_eq!(rel.formas_semeadas, 7);
    assert_eq!(rel.pedidos, 0);
    assert_eq!(rel.linhas_pagamento, 0);
    assert!(m006::aplicar(&db).await.unwrap().is_none());
    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn falha_na_verificacao_faz_rollback_e_preserva_dados() {
    let (db, path) = base_antiga("falha").await;
    semear_vendas(&db).await;
    // Sabotagem: pré-cria pagamento_pedido com uma linha órfã — o backfill soma em
    // cima e a verificação de Σ por pedido diverge (simula corrupção).
    run(&db, "CREATE TABLE pagamento_pedido (
        pedido_numero INTEGER NOT NULL,
        forma_id INTEGER NOT NULL,
        valor_centavos INTEGER NOT NULL,
        PRIMARY KEY (pedido_numero, forma_id)
    )")
    .await;
    run(&db, "INSERT INTO pagamento_pedido (pedido_numero, forma_id, valor_centavos) VALUES (1, 999, 123)").await;

    let r = m006::aplicar(&db).await;
    assert!(r.is_err(), "verificação divergente deve retornar Err (FR-016a)");

    // Rollback: colunas val_* intactas, nenhum valor perdido.
    assert_eq!(n(&db, "SELECT COALESCE(SUM(val_cartao),0) AS n FROM pedido").await, 6000);
    assert_eq!(n(&db, "SELECT COALESCE(SUM(val_dinheiro),0) AS n FROM pedido").await, 4000);
    assert_eq!(n(&db, "SELECT count(*) AS n FROM pedido").await, 3);

    let _ = std::fs::remove_file(&path);
}
