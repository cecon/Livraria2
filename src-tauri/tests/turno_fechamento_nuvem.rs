//! Fechamento vindo da nuvem (feature 013, US6 — T033, FR-019/FR-024).
//!
//! O escritório pode encerrar um turno; o estado desce pelo pull (o turno é
//! mutável na réplica). O caso feio: o PDV ainda tinha venda não sincronizada
//! desse turno. Regra: o turno fechado **permanece fechado** e as pendentes
//! migram para o turno aberto desta máquina — nenhuma venda se perde e nenhuma
//! volta a um turno fechado.

mod common;

use livraria_2_lib::adapters::persistencia::turno_repo::SeaTurnoRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports_turno::TurnoRepo;
use livraria_2_lib::application::turno;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};

async fn setup(tag: &str) -> (DatabaseConnection, std::path::PathBuf) {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path = std::env::temp_dir().join(format!("livraria_fechnuvem_{}_{tag}_{nanos}.db", std::process::id()));
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

/// Insere uma venda no turno. `sinc = false` → ainda não subiu (pendente).
async fn venda(db: &DatabaseConnection, numero: i64, turno_uid: &str, no_turno: i64, sinc: bool) {
    let marca = if sinc { "'2026-08-01T10:00:00'" } else { "NULL" };
    exec(db, &format!(
        "INSERT INTO pedido (numero,cliente,turno,data,total_centavos,turno_uid,numero_no_turno,estoque_status,sincronizado_em) \
         VALUES ({numero},'C','manha','2026-08-16',1000,'{turno_uid}',{no_turno},'pronta',{marca})"
    )).await;
}

/// Turno da venda + Pedido Nº dentro dele.
async fn onde(db: &DatabaseConnection, numero: i64) -> (String, i64) {
    let row = db
        .query_one(Statement::from_sql_and_values(
            db.get_database_backend(),
            "SELECT turno_uid, numero_no_turno FROM pedido WHERE numero = ?",
            [numero.into()],
        ))
        .await
        .unwrap()
        .expect("pedido");
    (
        row.try_get("", "turno_uid").unwrap_or_default(),
        row.try_get("", "numero_no_turno").unwrap_or(0),
    )
}

async fn status(db: &DatabaseConnection, uid: &str) -> String {
    db.query_one(Statement::from_sql_and_values(
        db.get_database_backend(),
        "SELECT status FROM turno_operacao WHERE sync_uid = ?",
        [uid.into()],
    ))
    .await
    .unwrap()
    .and_then(|r| r.try_get::<String>("", "status").ok())
    .unwrap_or_default()
}

/// Nuvem fecha o turno, PDV tinha 2 vendas pendentes: elas migram para um turno
/// NOVO (não havia aberto), renumeradas 1..n; o fechado continua fechado.
#[tokio::test]
async fn fechamento_da_nuvem_com_pendencias_cria_novo_turno() {
    let (db, path) = setup("cria_novo").await;
    let turnos = SeaTurnoRepo::new(db.clone());

    // Estado após o pull: o turno voltou 'encerrado' da nuvem.
    let t = turnos.abrir("op-1", 0, "PDV-TESTE").await.unwrap().sync_uid;
    venda(&db, 1, &t, 1, true).await; // já subiu — fica no turno fechado
    venda(&db, 2, &t, 2, false).await; // pendente
    venda(&db, 3, &t, 3, false).await; // pendente
    turnos.encerrar(&t, 0, 0, 0).await.unwrap();

    let migradas = turno::reconciliar_fechamento(&turnos, &common::MaquinaTeste).await.unwrap();
    assert_eq!(migradas, 2);

    let novo = turnos.turno_aberto_na_maquina("PDV-TESTE").await.unwrap().expect("turno novo aberto");
    assert_ne!(novo.sync_uid, t, "não reabre o turno fechado");
    assert_eq!(novo.operador, "op-1", "o novo turno herda o operador");
    assert_eq!(status(&db, &t).await, "encerrado", "o fechado permanece fechado");

    // As pendentes foram para o novo turno, renumeradas 1 e 2 (FR-016).
    assert_eq!(onde(&db, 2).await, (novo.sync_uid.clone(), 1));
    assert_eq!(onde(&db, 3).await, (novo.sync_uid, 2));
    // A que já tinha subido não se mexe.
    assert_eq!(onde(&db, 1).await, (t, 1));

    let _ = std::fs::remove_file(&path);
}

/// Havendo turno aberto nesta máquina, as pendentes entram NELE (FR-017: um
/// único turno aberto por PDV), continuando a numeração de lá.
#[tokio::test]
async fn pendencias_entram_no_turno_aberto_existente() {
    let (db, path) = setup("aberto_existente").await;
    let turnos = SeaTurnoRepo::new(db.clone());

    let fechado = turnos.abrir("op-1", 0, "PDV-TESTE").await.unwrap().sync_uid;
    venda(&db, 1, &fechado, 1, false).await;
    turnos.encerrar(&fechado, 0, 0, 0).await.unwrap();

    let aberto = turnos.abrir("op-2", 0, "PDV-TESTE").await.unwrap().sync_uid;
    venda(&db, 2, &aberto, 1, false).await; // já existe 1 venda no destino

    assert_eq!(turno::reconciliar_fechamento(&turnos, &common::MaquinaTeste).await.unwrap(), 1);
    assert_eq!(onde(&db, 1).await, (aberto.clone(), 2), "continua a numeração do destino");
    assert_eq!(onde(&db, 2).await, (aberto, 1), "a venda que já estava lá não muda");

    let _ = std::fs::remove_file(&path);
}

/// Sem pendências, nada acontece — e rodar de novo não cria turno do nada.
#[tokio::test]
async fn sem_pendencias_a_reconciliacao_e_inerte() {
    let (db, path) = setup("inerte").await;
    let turnos = SeaTurnoRepo::new(db.clone());

    let t = turnos.abrir("op-1", 0, "PDV-TESTE").await.unwrap().sync_uid;
    venda(&db, 1, &t, 1, true).await;
    turnos.encerrar(&t, 0, 0, 0).await.unwrap();

    assert_eq!(turno::reconciliar_fechamento(&turnos, &common::MaquinaTeste).await.unwrap(), 0);
    assert_eq!(turno::reconciliar_fechamento(&turnos, &common::MaquinaTeste).await.unwrap(), 0);
    assert!(
        turnos.turno_aberto_na_maquina("PDV-TESTE").await.unwrap().is_none(),
        "não inventa turno aberto quando não há o que migrar"
    );

    let _ = std::fs::remove_file(&path);
}

/// Turno fechado de OUTRA máquina não é reconciliado aqui (FR-015).
#[tokio::test]
async fn turno_de_outra_maquina_nao_e_reconciliado() {
    let (db, path) = setup("outra").await;
    let turnos = SeaTurnoRepo::new(db.clone());

    let outro = turnos.abrir("op-9", 0, "PDV-DA-OUTRA-LOJA").await.unwrap().sync_uid;
    venda(&db, 1, &outro, 1, false).await;
    turnos.encerrar(&outro, 0, 0, 0).await.unwrap();

    assert_eq!(turno::reconciliar_fechamento(&turnos, &common::MaquinaTeste).await.unwrap(), 0);
    assert_eq!(onde(&db, 1).await, (outro, 1), "a venda do outro PDV fica onde está");

    let _ = std::fs::remove_file(&path);
}
