use livraria_2_lib::adapters::persistencia::inicializar_schema;
use sea_orm::{ConnectionTrait, Database, DatabaseConnection, Statement};

#[tokio::test]
async fn integrity_failure_prevents_migration_writes() {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    for sql in ["CREATE TABLE fixture(n INTEGER CHECK(n>0))",
        "PRAGMA ignore_check_constraints=ON", "INSERT INTO fixture VALUES(-1)",
        "PRAGMA ignore_check_constraints=OFF"] {
        db.execute(Statement::from_string(db.get_database_backend(), sql.to_string())).await.unwrap();
    }
    let error = inicializar_schema(&db).await.unwrap_err();
    assert!(error.to_string().contains("migrações não foram iniciadas"));
    let row = db.query_one(Statement::from_string(db.get_database_backend(),
        "SELECT count(*) n FROM sqlite_schema WHERE type='table'".to_string())).await.unwrap().unwrap();
    assert_eq!(row.try_get::<i64>("", "n").unwrap(), 1);
}

async fn fingerprint(db: &DatabaseConnection) -> Vec<String> {
    let mut values = Vec::new();
    for sql in [
        "SELECT json_group_array(json_array(numero,cliente,turno,data,total_centavos,cancelado,sync_uid,operador,turno_uid,numero_no_turno)) value FROM (SELECT * FROM pedido ORDER BY numero)",
        "SELECT json_group_array(json_array(id,pedido_numero,codigo,titulo,preco_centavos,qtd,sync_uid)) value FROM (SELECT * FROM item_pedido ORDER BY id)",
        "SELECT json_group_array(json_array(pedido_numero,forma_id,valor_centavos,sync_uid)) value FROM (SELECT * FROM pagamento_pedido ORDER BY pedido_numero,forma_id)",
        "SELECT json_group_array(json_array(sync_uid,operador,abertura,encerramento,caixa_inicial_centavos,esperado_centavos,conferido_centavos,diferenca_centavos)) value FROM (SELECT * FROM turno_operacao ORDER BY sync_uid)",
    ] {
        let row = db.query_one(Statement::from_string(db.get_database_backend(), sql.to_string()))
            .await.unwrap().unwrap();
        values.push(row.try_get::<String>("", "value").unwrap());
    }
    values
}

/// Operates only on a temporary copy, never on the input database.
#[tokio::test]
#[ignore = "requires PDV_UPGRADE_SNAPSHOT pointing to a closed SQLite backup"]
async fn upgrade_snapshot_preserves_operations_and_is_repeatable() {
    let source = std::env::var_os("PDV_UPGRADE_SNAPSHOT").expect("snapshot required");
    let dir = tempfile::tempdir().unwrap();
    let copy = dir.path().join("upgrade.db");
    std::fs::copy(source, &copy).unwrap();
    let db = Database::connect(format!("sqlite://{}?mode=rw", copy.display())).await.unwrap();
    let before = fingerprint(&db).await;
    for _ in 0..3 {
        inicializar_schema(&db).await.unwrap();
        assert!(fingerprint(&db).await == before, "operational records changed");
        let check = db.query_all(Statement::from_string(db.get_database_backend(), "PRAGMA integrity_check".to_string())).await.unwrap();
        assert_eq!(check.len(), 1);
        assert_eq!(check[0].try_get::<String>("", "integrity_check").unwrap(), "ok");
    }
    db.close().await.unwrap();
}
