use livraria_2_lib::adapters::{nuvem::produtos::Produto,
    persistencia::{api_replica::SeaApiReplica, inicializar_schema, produto_pontual}};
use livraria_2_lib::application::api_sync::{PaginaApi, ReplicaApi};
use sea_orm::{ConnectionTrait, Database, DatabaseConnection, Statement};
use serde_json::json;

async fn value(db: &DatabaseConnection, sql: &str) -> String {
    db.query_one(Statement::from_string(db.get_database_backend(), sql.to_string())).await.unwrap()
        .unwrap().try_get("", "valor").unwrap()
}
fn produto(versao: &str, titulo: &str) -> Produto {
    Produto { uid: "a039ec41-22d9-40f8-ac38-d036d0203a85".into(), codigo: "123".into(),
        titulo: titulo.into(), autor: None, descricao: None, categoria: 0, preco_centavos: 1500,
        saldo_publicado: 8, ativo: true, excluido: false, versao: versao.into() }
}
fn page(seq: u64) -> PaginaApi {
    serde_json::from_value(json!({ "versao":1, "alteracoes":[{
        "sequencia":seq.to_string(),"produtoUid":produto("0", "").uid,"operacao":"upsert",
        "produto":{"codigo":"123","titulo":format!("evento {seq}"),"autor":null,
          "precoCentavos":1500,"ativo":true,"saldoPublicado":7}}],
        "proximoCursor":seq.to_string(),"temMais":false })).unwrap()
}
#[tokio::test]
async fn importacao_preserva_cursor_e_resiste_a_eventos_atrasados() {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    inicializar_schema(&db).await.unwrap();
    produto_pontual::importar(&db, &produto("501", "Cadastro atual")).await.unwrap();
    assert_eq!(value(&db, "SELECT CAST(count(*) AS TEXT) valor FROM sync_cursor WHERE recurso='api_catalogo_v1'").await, "0");
    for seq in 1..=501 { SeaApiReplica { db: db.clone() }.aplicar_pagina(&page(seq)).await.unwrap(); }
    assert_eq!(value(&db, "SELECT titulo valor FROM livro WHERE codigo='123'").await, "Cadastro atual");
    assert_eq!(value(&db, "SELECT last_cursor valor FROM sync_cursor WHERE recurso='api_catalogo_v1'").await, "501");
    SeaApiReplica { db: db.clone() }.aplicar_pagina(&page(502)).await.unwrap();
    produto_pontual::importar(&db, &produto("501", "Resposta atrasada")).await.unwrap();
    assert_eq!(value(&db, "SELECT titulo valor FROM livro WHERE codigo='123'").await, "evento 502");
}
#[tokio::test]
async fn colisao_de_codigo_nao_substitui_identidade_local() {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    inicializar_schema(&db).await.unwrap();
    db.execute(Statement::from_string(db.get_database_backend(),
        "INSERT INTO livro(codigo,titulo,sync_uid) VALUES('123','Local','outro')".to_string())).await.unwrap();
    assert!(produto_pontual::importar(&db, &produto("1", "Remoto")).await.is_err());
    assert_eq!(value(&db, "SELECT sync_uid valor FROM livro WHERE codigo='123'").await, "outro");
}
