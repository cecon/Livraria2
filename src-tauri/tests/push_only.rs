//! Vendas só sobem (feature 013, US2 — T018, FR-006/ADR-0025).
//!
//! O risco desta história é o **estoque**: o `saldo_operacional` compensa o
//! cancelamento apenas quando a nuvem JÁ debitou o `saldo_publicado`, e quem diz
//! isso é o `estoque_status` que vem da nuvem. Cortar o pull da venda sem mais
//! nada cegaria esse sinal e reintroduziria a sobrevenda do incidente v26.8.3.
//!
//! Por isso o push-only aqui tem uma exceção cirúrgica: do `pedido` desce só o
//! **ack de incorporação** (colunas `estoque_*`), e apenas para venda que já
//! existe localmente. Estes testes fixam exatamente essas fronteiras.

mod common;

use livraria_2_lib::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use livraria_2_lib::adapters::persistencia::replica_sync::SeaReplicaSync;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports_sync::{RegistroSync, ReplicaLocalRepo};
use livraria_2_lib::domain::sincronizacao::{desce_so_ack, pull_necessario, push_only};
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};
use serde_json::json;

async fn setup(tag: &str) -> (DatabaseConnection, std::path::PathBuf) {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path = std::env::temp_dir().join(format!("livraria_pushonly_{}_{tag}_{nanos}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    let db = conectar(&format!("sqlite://{}?mode=rwc", path.display())).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    (db, path)
}

async fn exec(db: &DatabaseConnection, sql: &str) {
    db.execute(Statement::from_string(db.get_database_backend(), sql.to_string()))
        .await
        .expect(sql);
}

async fn texto(db: &DatabaseConnection, sql: &str) -> String {
    db.query_one(Statement::from_string(db.get_database_backend(), sql.to_string()))
        .await
        .unwrap()
        .and_then(|r| r.try_get::<String>("", "v").ok())
        .unwrap_or_default()
}

async fn numero(db: &DatabaseConnection, sql: &str) -> i64 {
    db.query_one(Statement::from_string(db.get_database_backend(), sql.to_string()))
        .await
        .unwrap()
        .and_then(|r| r.try_get::<i64>("", "v").ok())
        .unwrap_or(-1)
}

fn reg(sync_uid: &str, dados: serde_json::Value) -> RegistroSync {
    RegistroSync {
        recurso: "pedido".into(),
        sync_uid: sync_uid.into(),
        dados,
        atualizado_em: Some("2026-08-16T12:00:00".into()),
        excluido_em: None,
    }
}

/// A política é a mesma para o caso de uso e para o adapter (fonte no domínio).
#[test]
fn politica_de_push_only() {
    for r in ["pedido", "item_pedido", "pagamento_pedido", "alocacao_venda"] {
        assert!(push_only(r), "{r} deve ser push-only");
    }
    for r in ["livro", "turno_operacao", "movimento_estoque", "usuario"] {
        assert!(!push_only(r), "{r} continua descendo");
    }
    // Só o pedido ainda é buscado (traz o ack); as filhas nem isso.
    assert!(pull_necessario("pedido") && desce_so_ack("pedido"));
    for r in ["item_pedido", "pagamento_pedido", "alocacao_venda"] {
        assert!(!pull_necessario(r), "{r} não precisa ser buscado na nuvem");
    }
    assert!(pull_necessario("livro") && !desce_so_ack("livro"));
}

/// Venda de OUTRO PDV que chega no pull não é inserida — o banco local não
/// cresce com histórico alheio, que é o objetivo da US2.
#[tokio::test]
async fn pull_nao_traz_venda_de_outro_pdv() {
    let (db, path) = setup("nao_insere").await;
    let local = SeaReplicaSync::new(db.clone());

    local
        .aplicar(
            "pedido",
            &[reg(
                "venda-de-outro-pdv",
                json!({
                    "numero": 9999, "cliente": "CLIENTE DO OUTRO", "turno": "manha",
                    "data": "2026-08-16", "total_centavos": 5000, "cancelado": false,
                    "estoque_status": "incorporada"
                }),
            )],
        )
        .await
        .unwrap();

    assert_eq!(numero(&db, "SELECT COUNT(*) AS v FROM pedido").await, 0, "venda não desce");

    // As filhas são ignoradas por completo (nem ack têm).
    for recurso in ["item_pedido", "pagamento_pedido", "alocacao_venda"] {
        local
            .aplicar(
                recurso,
                &[RegistroSync {
                    recurso: recurso.into(),
                    sync_uid: format!("{recurso}-de-fora"),
                    dados: json!({ "qtd": 1, "valor_centavos": 100 }),
                    atualizado_em: None,
                    excluido_em: None,
                }],
            )
            .await
            .unwrap();
        assert_eq!(numero(&db, &format!("SELECT COUNT(*) AS v FROM {recurso}")).await, 0);
    }

    let _ = std::fs::remove_file(&path);
}

/// O ack chega e atualiza SÓ o `estoque_status` da venda local — sem tocar em
/// nada do conteúdo. É o que mantém o saldo operacional exato.
#[tokio::test]
async fn ack_atualiza_so_o_estoque_status() {
    let (db, path) = setup("ack").await;
    let local = SeaReplicaSync::new(db.clone());

    exec(&db, "INSERT INTO pedido (numero,cliente,turno,data,total_centavos,sync_uid,estoque_status,sincronizado_em,atualizado_em) \
                VALUES (1,'MEU CLIENTE','manha','2026-08-16',3000,'venda-daqui','pronta','2026-08-16T10:00:00','2026-08-16T10:00:00')").await;

    local
        .aplicar(
            "pedido",
            &[reg(
                "venda-daqui",
                json!({
                    "numero": 1, "cliente": "SOBRESCRITO PELA NUVEM", "total_centavos": 999999,
                    "cancelado": true, "estoque_status": "incorporada",
                    "estoque_incorporada_em": "2026-08-16T12:00:00"
                }),
            )],
        )
        .await
        .unwrap();

    assert_eq!(texto(&db, "SELECT estoque_status AS v FROM pedido WHERE numero=1").await, "incorporada");
    // Conteúdo intacto: o ack não é a nuvem reescrevendo a venda.
    assert_eq!(texto(&db, "SELECT cliente AS v FROM pedido WHERE numero=1").await, "MEU CLIENTE");
    assert_eq!(numero(&db, "SELECT total_centavos AS v FROM pedido WHERE numero=1").await, 3000);
    assert_eq!(numero(&db, "SELECT cancelado AS v FROM pedido WHERE numero=1").await, 0);

    let _ = std::fs::remove_file(&path);
}

/// Cancelamento local pendente + ack chegando: o ack NÃO pode marcar a linha
/// como sincronizada, senão o cancelamento nunca subiria para a nuvem.
#[tokio::test]
async fn ack_nao_marca_cancelamento_pendente_como_enviado() {
    let (db, path) = setup("pendente").await;
    let local = SeaReplicaSync::new(db.clone());

    // Venda já sincronizada e depois cancelada aqui: `sincronizado_em` volta a NULL.
    exec(&db, "INSERT INTO pedido (numero,cliente,turno,data,total_centavos,sync_uid,estoque_status,cancelado,sincronizado_em,atualizado_em) \
                VALUES (1,'C','manha','2026-08-16',3000,'venda-cancelada','incorporada',1,NULL,'2026-08-16T11:00:00')").await;

    local
        .aplicar(
            "pedido",
            &[reg("venda-cancelada", json!({ "estoque_status": "incorporada", "cancelado": false })),],
        )
        .await
        .unwrap();

    assert_eq!(
        numero(&db, "SELECT COUNT(*) AS v FROM pedido WHERE sincronizado_em IS NULL").await,
        1,
        "o cancelamento segue pendente e vai subir"
    );
    assert_eq!(numero(&db, "SELECT cancelado AS v FROM pedido WHERE numero=1").await, 1);

    let _ = std::fs::remove_file(&path);
}

/// O que a US2 não pode quebrar: com o ack chegando, o saldo operacional segue
/// exatamente como antes nos dois cenários do incidente v26.8.3.
#[tokio::test]
async fn saldo_operacional_intacto_com_push_only() {
    let (db, path) = setup("saldo").await;
    let local = SeaReplicaSync::new(db.clone());
    let estoque = SeaEstoqueRepo::new(db.clone());

    exec(&db, "INSERT INTO livro (codigo,titulo,saldo_publicado,estoque) VALUES ('A',' A',121,121)").await;
    exec(&db, "INSERT INTO livro (codigo,titulo,saldo_publicado,estoque) VALUES ('B',' B',50,50)").await;

    // (1) Venda criada e cancelada OFFLINE: nunca subiu, a nuvem não debitou.
    //     Não pode compensar — senão 121 viraria 122.
    exec(&db, "INSERT INTO pedido (numero,cliente,turno,data,total_centavos,sync_uid,estoque_status,cancelado,sincronizado_em) \
                VALUES (1,'C','manha','2026-08-16',3000,'p1','pronta',1,NULL)").await;
    exec(&db, "INSERT INTO item_pedido (pedido_numero,codigo,titulo,preco_centavos,qtd) VALUES (1,'A','A',3000,1)").await;
    assert_eq!(estoque.saldo_operacional("A").await.unwrap(), 121);

    // (2) Venda sincronizada, a nuvem incorporou (ack) e o operador cancelou:
    //     aí sim compensa, porque o saldo_publicado já veio com o −1.
    exec(&db, "INSERT INTO pedido (numero,cliente,turno,data,total_centavos,sync_uid,estoque_status,cancelado,sincronizado_em) \
                VALUES (2,'C','manha','2026-08-16',3000,'p2','pronta',0,'2026-08-16T10:00:00')").await;
    exec(&db, "INSERT INTO item_pedido (pedido_numero,codigo,titulo,preco_centavos,qtd) VALUES (2,'B','B',3000,1)").await;

    // O ack desce e marca 'incorporada' (é ele que habilita a compensação).
    local
        .aplicar("pedido", &[reg("p2", json!({ "estoque_status": "incorporada" }))])
        .await
        .unwrap();
    exec(&db, "UPDATE pedido SET cancelado = 1, sincronizado_em = NULL WHERE numero = 2").await;

    assert_eq!(
        estoque.saldo_operacional("B").await.unwrap(),
        51,
        "cancelamento de venda já debitada pela nuvem compensa +1"
    );

    let _ = std::fs::remove_file(&path);
}
