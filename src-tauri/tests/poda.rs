//! Testes da retenção local de 45 dias (feature 013, US3 — T025).
//!
//! O ponto sensível é a ordem da cascata: as FKs locais são reais e estão ativas
//! em runtime (`alocacao_venda → item_pedido/pedido`, `item_pedido → pedido`,
//! `pagamento_pedido → pedido`). O teste monta o cluster COMPLETO justamente
//! para provar que a poda é FK-safe — lição do incidente 787/m013.

mod common;

use livraria_2_lib::adapters::persistencia::turno_repo::SeaTurnoRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::poda;
use livraria_2_lib::application::ports::Relogio;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};

/// Hoje = 2026-08-16. Um turno de 2026-06-01 tem 76 dias (podável); um de
/// 2026-07-20 tem 27 (fica).
struct RelogioFixo;
impl Relogio for RelogioFixo {
    fn hora_atual(&self) -> u32 {
        10
    }
    fn hoje_iso(&self) -> String {
        "2026-08-16".to_string()
    }
}

async fn setup(tag: &str) -> (DatabaseConnection, std::path::PathBuf) {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path = std::env::temp_dir().join(format!("livraria_poda_{}_{tag}_{nanos}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    let db = conectar(&format!("sqlite://{}?mode=rwc", path.display())).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    common::semear_formas(&db).await;
    common::semear_loja(&db).await;
    (db, path)
}

async fn exec(db: &DatabaseConnection, sql: &str) {
    db.execute(Statement::from_string(db.get_database_backend(), sql.to_string()))
        .await
        .expect(sql);
}

async fn contar(db: &DatabaseConnection, sql: &str) -> i64 {
    db.query_one(Statement::from_string(db.get_database_backend(), sql.to_string()))
        .await
        .unwrap()
        .and_then(|r| r.try_get::<i64>("", "n").ok())
        .unwrap_or(-1)
}

/// Turno + venda + item + pagamento + alocação — o cluster inteiro, com as FKs
/// que derrubaram a m013. `sinc` controla se tudo já subiu para a nuvem.
async fn semear_turno(
    db: &DatabaseConnection,
    uid: &str,
    abertura: &str,
    status: &str,
    numero: i64,
    sinc: bool,
) {
    let marca = if sinc { "'2026-08-01T10:00:00'" } else { "NULL" };
    exec(db, &format!(
        "INSERT INTO turno_operacao (sync_uid,operador,caixa_inicial_centavos,status,abertura,maquina,origem,atualizado_em,sincronizado_em) \
         VALUES ('{uid}','op-1',0,'{status}','{abertura}','PDV-TESTE','pdv','{abertura}',{marca})"
    )).await;
    exec(db, &format!(
        "INSERT INTO livro (codigo,titulo,preco_centavos,categoria,estoque,ativo,sync_uid) \
         VALUES ('L{numero}','Livro {numero}',3000,1,10,1,'livro-{numero}')"
    )).await;
    exec(db, &format!(
        "INSERT INTO pedido (numero,cliente,turno,data,total_centavos,turno_uid,numero_no_turno,estoque_status,sincronizado_em) \
         VALUES ({numero},'C','manha','{abertura}',3000,'{uid}',1,'incorporada',{marca})"
    )).await;
    exec(db, &format!(
        "INSERT INTO item_pedido (id,pedido_numero,codigo,titulo,preco_centavos,qtd,sincronizado_em) \
         VALUES ({numero},{numero},'L{numero}','Livro {numero}',3000,1,{marca})"
    )).await;
    exec(db, &format!(
        "INSERT INTO pagamento_pedido (pedido_numero,forma_id,valor_centavos,sincronizado_em) \
         VALUES ({numero},(SELECT id FROM forma_pagamento WHERE chave='dinheiro'),3000,{marca})"
    )).await;
    exec(db, &format!(
        "INSERT INTO alocacao_venda (pedido_numero,item_id,destinacao_id,qtd,valor_centavos) \
         VALUES ({numero},{numero},(SELECT id FROM destinacao WHERE de_sistema=1),1,3000)"
    )).await;
}

/// Poda o turno encerrado + sincronizado + >45d, com o cluster inteiro, sem
/// violar FK; preserva aberto, não-sincronizado e recente; não toca no livro.
#[tokio::test]
async fn poda_remove_cluster_antigo_e_preserva_o_resto() {
    let (db, path) = setup("cluster").await;
    let turnos = SeaTurnoRepo::new(db.clone());

    semear_turno(&db, "t-velho", "2026-06-01", "encerrado", 1, true).await; // 76d → poda
    semear_turno(&db, "t-recente", "2026-07-20", "encerrado", 2, true).await; // 27d → fica
    semear_turno(&db, "t-aberto", "2026-05-01", "aberto", 3, true).await; // aberto → fica
    semear_turno(&db, "t-pendente", "2026-05-02", "encerrado", 4, false).await; // não subiu → fica

    // FKs realmente ativas neste banco (senão o teste não provaria nada).
    let fk: i64 = db
        .query_one(Statement::from_string(
            db.get_database_backend(),
            "PRAGMA foreign_keys".to_string(),
        ))
        .await
        .unwrap()
        .and_then(|r| r.try_get::<i64>("", "foreign_keys").ok())
        .unwrap_or(0);
    assert_eq!(fk, 1, "o teste precisa das FKs ativas para valer");

    let r = poda::podar(&turnos, &RelogioFixo).await.unwrap();
    assert_eq!(r.turnos, 1, "só o turno encerrado, sincronizado e >45d");
    assert_eq!(r.linhas, 5, "turno + pedido + item + pagamento + alocação");

    assert_eq!(contar(&db, "SELECT COUNT(*) AS n FROM turno_operacao").await, 3);
    assert_eq!(contar(&db, "SELECT COUNT(*) AS n FROM pedido WHERE turno_uid='t-velho'").await, 0);
    assert_eq!(contar(&db, "SELECT COUNT(*) AS n FROM item_pedido WHERE pedido_numero=1").await, 0);
    assert_eq!(contar(&db, "SELECT COUNT(*) AS n FROM pagamento_pedido WHERE pedido_numero=1").await, 0);
    assert_eq!(contar(&db, "SELECT COUNT(*) AS n FROM alocacao_venda WHERE pedido_numero=1").await, 0);
    // Os outros três turnos seguem inteiros.
    assert_eq!(contar(&db, "SELECT COUNT(*) AS n FROM pedido").await, 3);
    assert_eq!(contar(&db, "SELECT COUNT(*) AS n FROM alocacao_venda").await, 3);

    // Poda é retenção, não estorno: o acervo e o saldo não se mexem.
    assert_eq!(contar(&db, "SELECT COUNT(*) AS n FROM livro").await, 4);
    assert_eq!(contar(&db, "SELECT estoque AS n FROM livro WHERE codigo='L1'").await, 10);

    let _ = std::fs::remove_file(&path);
}

/// Idempotente: a segunda passada não acha mais nada (e não erra).
#[tokio::test]
async fn poda_e_idempotente() {
    let (db, path) = setup("idem").await;
    let turnos = SeaTurnoRepo::new(db.clone());
    semear_turno(&db, "t-velho", "2026-06-01", "encerrado", 1, true).await;

    assert_eq!(poda::podar(&turnos, &RelogioFixo).await.unwrap().turnos, 1);
    let segunda = poda::podar(&turnos, &RelogioFixo).await.unwrap();
    assert_eq!(segunda.turnos, 0);
    assert_eq!(segunda.linhas, 0);

    let _ = std::fs::remove_file(&path);
}

/// A fronteira exata da regra: 45 dias fica, 46 sai (o domínio exige > 45).
#[tokio::test]
async fn poda_respeita_a_fronteira_dos_45_dias() {
    let (db, path) = setup("fronteira").await;
    let turnos = SeaTurnoRepo::new(db.clone());
    semear_turno(&db, "t-45", "2026-07-02", "encerrado", 1, true).await; // 45 dias
    semear_turno(&db, "t-46", "2026-07-01", "encerrado", 2, true).await; // 46 dias

    assert_eq!(poda::podar(&turnos, &RelogioFixo).await.unwrap().turnos, 1);
    assert_eq!(contar(&db, "SELECT COUNT(*) AS n FROM turno_operacao WHERE sync_uid='t-45'").await, 1);
    assert_eq!(contar(&db, "SELECT COUNT(*) AS n FROM turno_operacao WHERE sync_uid='t-46'").await, 0);

    let _ = std::fs::remove_file(&path);
}
