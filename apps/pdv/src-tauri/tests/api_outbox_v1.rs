use livraria_2_lib::adapters::persistencia::{api_replica::SeaApiReplica, inicializar_schema};
use livraria_2_lib::application::api_sync::ReplicaApi;
use sea_orm::{ConnectionTrait, Database, Statement};
use serde_json::json;

async fn fixture() -> SeaApiReplica {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let statements = [
        "INSERT INTO livro(codigo,titulo,sync_uid) VALUES('503','Livro','00000000-0000-4000-8000-000000000001')",
        "INSERT INTO pedido(numero,cliente,turno,data,total_centavos,estoque_status)
         VALUES(6535,'CLIENTE','teste','2026-09-14',6200,'pronta')",
        "INSERT INTO item_pedido(pedido_numero,livro_uid,codigo,titulo,preco_centavos,qtd)
         SELECT 6535,sync_uid,'503','Livro',3100,2 FROM livro WHERE codigo='503'",
        "INSERT INTO forma_pagamento(chave,rotulo,sync_uid)
         VALUES('pix','PIX','00000000-0000-4000-8000-000000000002')",
        "INSERT INTO pagamento_pedido(pedido_numero,forma_id,valor_centavos)
         SELECT 6535,id,6200 FROM forma_pagamento WHERE chave='pix'",
    ];
    for s in statements {
        db.execute(Statement::from_string(
            db.get_database_backend(),
            s.to_string(),
        ))
        .await
        .unwrap();
    }
    SeaApiReplica { db }
}

#[tokio::test]
async fn offline_repeticao_preserva_payload_uids_e_preco_da_venda() {
    let local = fixture().await;
    local.preparar_envios().await.unwrap();
    let first = local.envios().await.unwrap().remove(0);
    assert_eq!(first.corpo["itens"][0]["precoCentavos"], 3100);
    assert_eq!(first.corpo["pagamentos"][0]["valorCentavos"], 6200);
    local.preparar_envios().await.unwrap();
    let second = local.envios().await.unwrap().remove(0);
    assert_eq!(first.chave, second.chave);
    assert_eq!(first.corpo, second.corpo);
    local
        .confirmar_envio(&second, &json!({"estoqueStatus":"incorporada"}))
        .await
        .unwrap();
    assert!(local.envios().await.unwrap().is_empty());
    local.preparar_envios().await.unwrap();
    assert!(local.envios().await.unwrap().is_empty());
}

#[tokio::test]
async fn cancelamento_durante_envio_preserva_pendente_e_cria_operacao_separada() {
    let local = fixture().await;
    local.preparar_envios().await.unwrap();
    let sale = local.envios().await.unwrap().remove(0);
    local
        .db
        .execute(Statement::from_string(
            local.db.get_database_backend(),
            "UPDATE pedido SET cancelado=1 WHERE numero=6535".to_string(),
        ))
        .await
        .unwrap();
    local
        .confirmar_envio(&sale, &json!({"estoqueStatus":"incorporada"}))
        .await
        .unwrap();
    local.preparar_envios().await.unwrap();
    let cancel = local.envios().await.unwrap().remove(0);
    assert!(cancel.cancelamento);
    assert_eq!(cancel.uid, sale.uid);
    local
        .confirmar_envio(&cancel, &json!({"cancelado":true}))
        .await
        .unwrap();
    local.preparar_envios().await.unwrap();
    assert!(local.envios().await.unwrap().is_empty());
}

#[tokio::test]
async fn alteracao_financeira_apos_recebimento_exige_reconciliacao() {
    let local = fixture().await;
    local.preparar_envios().await.unwrap();
    let sale = local.envios().await.unwrap().remove(0);
    local
        .confirmar_envio(&sale, &json!({"estoqueStatus":"incorporada"}))
        .await
        .unwrap();
    local
        .db
        .execute(Statement::from_string(
            local.db.get_database_backend(),
            "UPDATE pedido SET total_centavos=6000,sincronizado_em=NULL WHERE numero=6535"
                .to_string(),
        ))
        .await
        .unwrap();
    assert!(local.preparar_envios().await.is_err());
}

#[tokio::test]
async fn turno_encerrado_sobe_abertura_e_fechamento() {
    let local = fixture().await;
    local
        .db
        .execute(Statement::from_string(
            local.db.get_database_backend(),
            "INSERT INTO usuario(usuario,senha_hash,nome,sync_uid)
         VALUES('mercia','h','Mercia','00000000-0000-4000-8000-000000000003')"
                .to_string(),
        ))
        .await
        .unwrap();
    local
        .db
        .execute(Statement::from_string(
            local.db.get_database_backend(),
            "INSERT INTO turno_operacao(sync_uid,operador,caixa_inicial_centavos,status,abertura,
          encerramento,esperado_centavos,conferido_centavos,diferenca_centavos,origem,atualizado_em)
         VALUES('00000000-0000-4000-8000-000000000004','mercia',15500,'encerrado',
          '2026-09-20T08:24:49','2026-09-20T20:43:13',22000,22000,0,'pdv','2026-09-20T20:43:13')"
                .to_string(),
        ))
        .await
        .unwrap();
    local.preparar_envios().await.unwrap();
    let envios = local.envios().await.unwrap();
    let abertura = envios
        .iter()
        .find(|e| e.chave.ends_with(":turno_abertura"))
        .unwrap();
    assert_eq!(abertura.corpo["caixaInicialCentavos"], 15500);
    let fechamento = envios
        .iter()
        .find(|e| e.chave.ends_with(":turno_fechamento"))
        .unwrap();
    assert_eq!(fechamento.corpo["conferidoCentavos"], 22000);
    local
        .confirmar_envio(abertura, &json!({"turnoUid":abertura.uid,"recebido":true}))
        .await
        .unwrap();
    let pendente = local.db.query_one(Statement::from_string(local.db.get_database_backend(),
        "SELECT sincronizado_em FROM turno_operacao WHERE sync_uid='00000000-0000-4000-8000-000000000004'"
            .to_string())).await.unwrap().unwrap();
    assert!(pendente
        .try_get::<Option<String>>("", "sincronizado_em")
        .unwrap()
        .is_none());
    local
        .confirmar_envio(
            fechamento,
            &json!({"turnoUid":fechamento.uid,"encerrado":true}),
        )
        .await
        .unwrap();
    let enviado = local.db.query_one(Statement::from_string(local.db.get_database_backend(),
        "SELECT sincronizado_em FROM turno_operacao WHERE sync_uid='00000000-0000-4000-8000-000000000004'"
            .to_string())).await.unwrap().unwrap();
    assert!(enviado
        .try_get::<Option<String>>("", "sincronizado_em")
        .unwrap()
        .is_some());
}
