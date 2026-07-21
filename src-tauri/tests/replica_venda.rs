//! Valida o FK-remap das tabelas de venda na réplica local (feature 007):
//! `pedido.operador` (texto → usuario.sync_uid), `pedido_numero` (→ pedido.sync_uid),
//! `forma_id` (→ forma_pagamento.sync_uid). Sem rede — base SQLite migrada.

use livraria_2_lib::adapters::persistencia::inicializar_schema;
use livraria_2_lib::adapters::persistencia::replica_sync::SeaReplicaSync;
use livraria_2_lib::application::ports_sync::ReplicaLocalRepo;
use sea_orm::{ConnectionTrait, Database, DatabaseConnection, Statement};

async fn exec(db: &DatabaseConnection, sql: String) {
    db.execute(Statement::from_string(db.get_database_backend(), sql)).await.unwrap();
}

async fn escalar(db: &DatabaseConnection, sql: String) -> String {
    let rows = db.query_all(Statement::from_string(db.get_database_backend(), sql)).await.unwrap();
    rows[0].try_get::<String>("", "v").unwrap()
}

#[tokio::test]
async fn venda_remapeia_operador_pedido_e_forma_por_sync_uid() {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    inicializar_schema(&db).await.unwrap();

    exec(&db, "INSERT INTO usuario (usuario,senha_hash,nome) VALUES ('joao','h','João')".into()).await;
    exec(&db, "INSERT INTO livro (codigo,titulo) VALUES ('789','L')".into()).await;
    exec(&db, "INSERT INTO pedido (numero,cliente,turno,data,total_centavos,operador) VALUES (5000,'C','manha','2026-07-20',1500,'joao')".into()).await;
    let fid = escalar(&db, "SELECT CAST(id AS TEXT) AS v FROM forma_pagamento LIMIT 1".into()).await;
    exec(&db, format!("INSERT INTO pagamento_pedido (pedido_numero,forma_id,valor_centavos) VALUES (5000,{fid},1500)")).await;

    let repo = SeaReplicaSync::new(db.clone());
    // pendentes (em ordem de dependência) atribui sync_uid aos pais.
    for r in ["usuario", "forma_pagamento", "pedido", "pagamento_pedido"] {
        repo.pendentes(r).await.unwrap();
    }
    let uid_joao = escalar(&db, "SELECT sync_uid AS v FROM usuario WHERE usuario='joao'".into()).await;
    let uid_forma = escalar(&db, format!("SELECT sync_uid AS v FROM forma_pagamento WHERE id={fid}")).await;
    let uid_pedido = escalar(&db, "SELECT sync_uid AS v FROM pedido WHERE numero=5000".into()).await;

    let ped = &repo.pendentes("pedido").await.unwrap()[0];
    assert_eq!(ped.dados["operador_uid"], serde_json::json!(uid_joao), "operador→usuario por texto");

    let pag = &repo.pendentes("pagamento_pedido").await.unwrap()[0];
    assert_eq!(pag.dados["pedido_uid"], serde_json::json!(uid_pedido), "pedido_numero→pedido.sync_uid");
    assert_eq!(pag.dados["forma_uid"], serde_json::json!(uid_forma), "forma_id→forma.sync_uid");
    println!("OK: remap de venda (operador/pedido/forma) por sync_uid");
}
