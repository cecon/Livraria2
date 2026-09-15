use async_trait::async_trait;
use livraria_2_lib::adapters::persistencia::{api_replica::SeaApiReplica, inicializar_schema};
use livraria_2_lib::application::api_sync::*;
use livraria_2_lib::application::ports::RepoErro;
use sea_orm::{ConnectionTrait, Database, DatabaseConnection, Statement};
use serde_json::{json, Value};
use std::sync::Mutex;

async fn local() -> SeaApiReplica {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    inicializar_schema(&db).await.unwrap();
    SeaApiReplica { db }
}
async fn sql(db: &DatabaseConnection, text: &str) {
    db.execute(Statement::from_string(db.get_database_backend(), text.to_string())).await.unwrap();
}
fn page(seq: u64, uid: &str, code: &str) -> PaginaApi {
    serde_json::from_value(json!({
        "versao":1,"alteracoes":[{"sequencia":seq.to_string(),"produtoUid":uid,"operacao":"upsert",
          "produto":{"codigo":code,"titulo":"Livro teste","autor":null,"precoCentavos":6000,
            "ativo":true,"saldoPublicado":49}}],
        "proximoCursor":seq.to_string(),"temMais":false
    })).unwrap()
}

#[tokio::test]
async fn isbn_troca_codigo_preservando_id_e_quarentena_alias_antigo() {
    let local = local().await;
    let uid = uuid::Uuid::new_v4().to_string();
    local.aplicar_pagina(&page(1, &uid, "503")).await.unwrap();
    sql(&local.db, "INSERT INTO livro(codigo,titulo,sync_uid) VALUES('9786585995887','Duplicado','antigo')").await;
    let before = local.db.query_one(Statement::from_string(local.db.get_database_backend(),
        "SELECT id FROM livro WHERE codigo='503'".to_string())).await.unwrap().unwrap().try_get::<i64>("", "id").unwrap();
    local.aplicar_pagina(&page(2, &uid, "9786585995887")).await.unwrap();
    let after = local.db.query_one(Statement::from_string(local.db.get_database_backend(),
        "SELECT id,estoque FROM livro WHERE codigo='9786585995887'".to_string())).await.unwrap().unwrap();
    assert_eq!(after.try_get::<i64>("", "id").unwrap(), before);
    assert_eq!(after.try_get::<i64>("", "estoque").unwrap(), 49);
    let quarantined = local.db.query_one(Statement::from_string(local.db.get_database_backend(),
        "SELECT ativo,codigo FROM livro WHERE sync_uid='antigo'".to_string())).await.unwrap().unwrap();
    assert_eq!(quarantined.try_get::<i64>("", "ativo").unwrap(), 0);
    assert!(quarantined.try_get::<String>("", "codigo").unwrap().starts_with("LOCAL-CONFLITO-"));
}

#[tokio::test]
async fn falha_na_segunda_linha_reverte_pagina_inteira_e_cursor() {
    let local = local().await;
    sql(&local.db, "CREATE TRIGGER bloquear BEFORE INSERT ON livro WHEN NEW.codigo='FALHAR'
        BEGIN SELECT RAISE(ABORT,'teste'); END").await;
    let mut p = page(1, &uuid::Uuid::new_v4().to_string(), "OK");
    p.alteracoes.extend(page(2, &uuid::Uuid::new_v4().to_string(), "FALHAR").alteracoes);
    p.proximo_cursor = "2".into();
    assert!(local.aplicar_pagina(&p).await.is_err());
    assert_eq!(local.cursor().await.unwrap(), "0");
    let count = local.db.query_one(Statement::from_string(local.db.get_database_backend(),
        "SELECT count(*) AS n FROM livro".to_string())).await.unwrap().unwrap().try_get::<i64>("", "n").unwrap();
    assert_eq!(count, 0);
}

struct Remote { uid: String, fail_ack: Mutex<bool>, acks: Mutex<Vec<String>> }
#[async_trait]
impl NuvemApi for Remote {
    async fn pagina(&self, cursor: &str) -> Result<PaginaApi, RepoErro> {
        if cursor == "0" { Ok(page(1, &self.uid, "503")) } else {
            Ok(PaginaApi { versao: 1, alteracoes: vec![], proximo_cursor: cursor.into(), tem_mais: false })
        }
    }
    async fn confirmar(&self, cursor: &str) -> Result<(), RepoErro> {
        self.acks.lock().unwrap().push(cursor.into());
        if cursor == "1" && *self.fail_ack.lock().unwrap() {
            *self.fail_ack.lock().unwrap() = false;
            return Err(RepoErro::Persistencia("rede offline apos commit".into()));
        }
        Ok(())
    }
    async fn enviar(&self, _: &EnvioApi) -> Result<Value, RepoErro> { unreachable!() }
}

#[tokio::test]
async fn ack_perdido_reenvia_cursor_commitado_antes_de_buscar_outra_pagina() {
    let local = local().await;
    let remote = Remote { uid: uuid::Uuid::new_v4().to_string(),
        fail_ack: Mutex::new(true), acks: Mutex::new(vec![]) };
    assert!(sincronizar_api(&remote, &local).await.is_err());
    assert_eq!(local.cursor().await.unwrap(), "1");
    sincronizar_api(&remote, &local).await.unwrap();
    assert_eq!(remote.acks.lock().unwrap().as_slice(), ["0", "1", "1", "1"]);
}

#[tokio::test]
async fn tombstone_desativa_produto_e_pagina_invalida_nao_avanca() {
    let local = local().await;
    let uid = uuid::Uuid::new_v4().to_string();
    local.aplicar_pagina(&page(1, &uid, "503")).await.unwrap();
    let p = PaginaApi { versao: 1, alteracoes: vec![EventoApi {
        sequencia: "2".into(), produto_uid: uid, operacao: "delete".into(), produto: None,
    }], proximo_cursor: "2".into(), tem_mais: false };
    local.aplicar_pagina(&p).await.unwrap();
    assert!(local.aplicar_pagina(&p).await.is_err());
    assert_eq!(local.cursor().await.unwrap(), "2");
    let active = local.db.query_one(Statement::from_string(local.db.get_database_backend(),
        "SELECT ativo FROM livro WHERE codigo='503'".to_string())).await.unwrap().unwrap().try_get::<i64>("", "ativo").unwrap();
    assert_eq!(active, 0);
}

#[tokio::test]
#[ignore = "somente com API NestJS isolada em localhost:3003"]
async fn http_real_nestjs_aplica_catalogo_e_confirma() {
    assert_eq!(std::env::var("NUVEM_API_URL").unwrap(), "http://127.0.0.1:3003");
    let remote = livraria_2_lib::adapters::nuvem::api_sync::ApiSync::conectar().await.unwrap();
    let local = local().await;
    let result = sincronizar_api(&remote, &local).await.unwrap();
    assert!(result.recebidos > 0);
    assert_ne!(local.cursor().await.unwrap(), "0");
    let form_uid = std::env::var("NUVEM_TEST_FORMA_UID").unwrap();
    let backend = local.db.get_database_backend();
    local.db.execute(Statement::from_sql_and_values(backend,
        "INSERT INTO forma_pagamento(chave,rotulo,sync_uid) VALUES('pix','PIX',?)
         ON CONFLICT(chave) DO UPDATE SET sync_uid=excluded.sync_uid", [form_uid.into()])).await.unwrap();
    sql(&local.db, "INSERT INTO pedido(numero,cliente,turno,data,total_centavos,estoque_status)
      VALUES(9999,'CLIENTE','teste','2026-09-14',6200,'pronta')").await;
    sql(&local.db, "INSERT INTO item_pedido(pedido_numero,livro_uid,codigo,titulo,preco_centavos,qtd)
      SELECT 9999,sync_uid,codigo,titulo,3100,2 FROM livro WHERE ativo=1 LIMIT 1").await;
    sql(&local.db, "INSERT INTO pagamento_pedido(pedido_numero,forma_id,valor_centavos)
      SELECT 9999,id,6200 FROM forma_pagamento WHERE chave='pix'").await;
    local.preparar_envios().await.unwrap();
    let sale = local.envios().await.unwrap().remove(0);
    // Server receives the sale, but the local process loses the response.
    let received = remote.enviar(&sale).await.unwrap();
    assert_eq!(received["estoqueStatus"], "incorporada");
    assert_eq!(remote.enviar(&sale).await.unwrap(), received);
    let resumed = sincronizar_api(&remote, &local).await.unwrap();
    assert_eq!(resumed.enviados, 1);
    assert!(local.envios().await.unwrap().is_empty());
    assert_eq!(sincronizar_api(&remote, &local).await.unwrap().enviados, 0);
    let saldo = local.db.query_one(Statement::from_string(backend,
        "SELECT saldo_publicado FROM livro WHERE ativo=1 LIMIT 1".to_string()))
        .await.unwrap().unwrap().try_get::<i64>("", "saldo_publicado").unwrap();
    assert_eq!(saldo, 6);
}
