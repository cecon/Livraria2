use livraria_2_lib::adapters::persistencia::{api_referencias::aplicar, inicializar_schema};
use sea_orm::{ConnectionTrait, Database, DatabaseConnection, Statement};
use serde_json::json;

async fn read(db: &DatabaseConnection, sql: &str) -> sea_orm::QueryResult {
    db.query_one(Statement::from_string(db.get_database_backend(), sql.to_string()))
        .await.unwrap().unwrap()
}

#[tokio::test]
async fn referencias_preservam_id_local_e_nao_viram_pendencias() {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    inicializar_schema(&db).await.unwrap();
    db.execute(Statement::from_string(db.get_database_backend(),
        "INSERT INTO forma_pagamento(chave,rotulo,de_sistema,ativa,ordem,sync_uid) VALUES('pix','Pix',1,1,1,'local-pix')".to_string()))
        .await.unwrap();
    let before = read(&db, "SELECT id,chave FROM forma_pagamento LIMIT 1").await;
    let id = before.try_get::<i64>("", "id").unwrap();
    let chave = before.try_get::<String>("", "chave").unwrap();
    let row = json!({"sync_uid":uuid::Uuid::new_v4().to_string(),"chave":chave,
        "rotulo":"Atualizado","de_sistema":true,"ativa":true,"ordem":1,"excluido_em":null});
    aplicar(&db, "forma_pagamento", &[row.clone()]).await.unwrap();
    aplicar(&db, "forma_pagamento", &[row]).await.unwrap();
    let after = read(&db, &format!("SELECT id,rotulo,sincronizado_em FROM forma_pagamento WHERE id={id}")).await;
    assert_eq!(after.try_get::<i64>("", "id").unwrap(), id);
    assert_eq!(after.try_get::<String>("", "rotulo").unwrap(), "Atualizado");
    assert!(after.try_get::<Option<String>>("", "sincronizado_em").unwrap().is_some());
}

#[tokio::test]
async fn pagina_invalida_reverte_todos_os_registros() {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let row = json!({"sync_uid":uuid::Uuid::new_v4().to_string(),"usuario":"novo",
        "nome":"Novo","perfil":"operador","senha_hash":"hash-teste","excluido_em":null});
    assert!(aplicar(&db, "usuario", &[row, json!({"sync_uid":"invalido"})]).await.is_err());
    let count = read(&db, "SELECT COUNT(*) AS n FROM usuario WHERE usuario='novo'").await;
    assert_eq!(count.try_get::<i64>("", "n").unwrap(), 0);
}
