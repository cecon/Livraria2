//! Testes de integração do turno como unidade da venda (feature 013, US1 — T013):
//! venda sem turno bloqueada; com turno vincula (`turno_uid` + `numero_no_turno`);
//! cancelamento só do turno aberto; um único turno aberto por máquina (FR-017).

mod common;

use livraria_2_lib::adapters::persistencia::forma_pagamento_repo::SeaFormaPagamentoRepo;
use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use livraria_2_lib::adapters::persistencia::turno_repo::SeaTurnoRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports::{LivroRepo, Relogio};
use livraria_2_lib::application::ports_turno::TurnoRepo;
use livraria_2_lib::application::venda::{registrar_venda, ItemInput, RecebimentoInput, VendaInput};
use livraria_2_lib::application::{cancelamento, turno};
use livraria_2_lib::domain::categoria::Categoria;
use livraria_2_lib::domain::dinheiro::Dinheiro;
use livraria_2_lib::domain::livro::Livro;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};

const CODIGO: &str = "9788573671469";

struct RelogioFixo;
impl Relogio for RelogioFixo {
    fn hora_atual(&self) -> u32 {
        15
    }
    fn hoje_iso(&self) -> String {
        "2026-07-05".to_string()
    }
}

async fn setup(tag: &str) -> (DatabaseConnection, std::path::PathBuf) {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path = std::env::temp_dir()
        .join(format!("livraria_turnovenda_{}_{tag}_{nanos}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    let db = conectar(&format!("sqlite://{}?mode=rwc", path.display())).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    common::semear_formas(&db).await; // feature 012: formas descem da nuvem
    SeaLivroRepo::new(db.clone())
        .salvar(&Livro {
            codigo: CODIGO.into(),
            titulo: "A Cruz de Cristo".into(),
            autor: None,
            preco: Dinheiro::de_centavos(3000),
            categoria: Categoria::EstudoTeologia,
            estoque: 50,
            descricao: None,
            custo_medio: Dinheiro::ZERO,
        })
        .await
        .unwrap();
    (db, path)
}

fn input(qtd: i64) -> VendaInput {
    VendaInput {
        cliente: "".into(),
        operador: Some("op-1".into()),
        itens: vec![ItemInput { codigo: CODIGO.into(), qtd }],
        pagamentos: vec![RecebimentoInput { forma_id: 3, valor_centavos: qtd * 3000 }],
    }
}

async fn vender(db: &DatabaseConnection, qtd: i64) -> Result<i64, String> {
    let livros = SeaLivroRepo::new(db.clone());
    let pedidos = SeaPedidoRepo::new(db.clone());
    let formas = SeaFormaPagamentoRepo::new(db.clone());
    let turnos = SeaTurnoRepo::new(db.clone());
    registrar_venda(
        input(qtd),
        &livros,
        &pedidos,
        &formas,
        &RelogioFixo,
        &turnos,
        &common::MaquinaTeste,
    )
    .await
    .map(|p| p.numero)
    .map_err(|e| e.codigo())
}

/// `(turno_uid, numero_no_turno)` gravados no pedido.
async fn vinculo(db: &DatabaseConnection, numero: i64) -> (Option<String>, Option<i64>) {
    let row = db
        .query_one(Statement::from_sql_and_values(
            db.get_database_backend(),
            "SELECT turno_uid, numero_no_turno FROM pedido WHERE numero = ?",
            [numero.into()],
        ))
        .await
        .unwrap()
        .expect("pedido gravado");
    (row.try_get("", "turno_uid").ok(), row.try_get("", "numero_no_turno").ok())
}

/// FR-002: sem turno aberto o PDV não registra venda — e nada é gravado.
#[tokio::test]
async fn venda_sem_turno_e_bloqueada_e_nao_grava_nada() {
    let (db, path) = setup("sem_turno").await;

    assert_eq!(vender(&db, 1).await, Err("VENDA_SEM_TURNO".into()));

    let n: i64 = db
        .query_one(Statement::from_string(
            db.get_database_backend(),
            "SELECT COUNT(*) AS n FROM pedido".to_string(),
        ))
        .await
        .unwrap()
        .and_then(|r| r.try_get("", "n").ok())
        .unwrap();
    assert_eq!(n, 0, "venda recusada não pode deixar rastro");
    // Estoque intacto.
    let livro = SeaLivroRepo::new(db.clone()).por_codigo(CODIGO).await.unwrap().unwrap();
    assert_eq!(livro.estoque, 50);

    let _ = std::fs::remove_file(&path);
}

/// FR-003/FR-016: com turno aberto, cada venda nasce vinculada e numerada 1..n.
#[tokio::test]
async fn venda_com_turno_vincula_e_numera_por_turno() {
    let (db, path) = setup("vincula").await;
    let uid = common::abrir_turno(&db, "op-1").await;

    let p1 = vender(&db, 1).await.unwrap();
    let p2 = vender(&db, 2).await.unwrap();

    assert_eq!(vinculo(&db, p1).await, (Some(uid.clone()), Some(1)));
    assert_eq!(vinculo(&db, p2).await, (Some(uid), Some(2)), "Pedido Nº é sequencial no turno");
    // O número global segue contínuo (não reinicia) — só o Pedido Nº do turno é 1..n.
    assert_eq!(p2, p1 + 1);

    let _ = std::fs::remove_file(&path);
}

/// FR-017: um único turno aberto por máquina — quem abre de novo continua no mesmo.
#[tokio::test]
async fn segundo_turno_na_mesma_maquina_continua_no_aberto() {
    let (db, path) = setup("unico").await;
    let turnos = SeaTurnoRepo::new(db.clone());

    let t1 = turno::abrir_ou_continuar(&turnos, &common::MaquinaTeste, "op-1", 10000).await.unwrap();
    // Outro operador na mesma máquina entra no turno que já está aberto.
    let t2 = turno::abrir_ou_continuar(&turnos, &common::MaquinaTeste, "op-2", 0).await.unwrap();
    assert_eq!(t1.sync_uid, t2.sync_uid, "não nasce um 2º turno");
    assert_eq!(t2.caixa_inicial_centavos, 10000, "o caixa segue o do turno aberto");
    assert_eq!(t2.operador, "op-1", "o turno mantém quem o abriu");
    assert_eq!(t2.maquina.as_deref(), Some("PDV-TESTE"));

    // Após encerrar, um novo turno pode nascer.
    turnos.encerrar(&t1.sync_uid, 0, 0, 0).await.unwrap();
    let t3 = turno::abrir_ou_continuar(&turnos, &common::MaquinaTeste, "op-2", 0).await.unwrap();
    assert_ne!(t3.sync_uid, t1.sync_uid);
    assert_eq!(t3.operador, "op-2");

    let _ = std::fs::remove_file(&path);
}

/// Turno aberto em OUTRA máquina (desceu pela réplica) não vale como turno deste PDV.
#[tokio::test]
async fn turno_de_outra_maquina_nao_libera_a_venda() {
    let (db, path) = setup("outra_maquina").await;
    let turnos = SeaTurnoRepo::new(db.clone());
    turnos.abrir("op-9", 0, "PDV-DA-OUTRA-LOJA").await.unwrap();

    assert!(turnos.turno_aberto_na_maquina("PDV-TESTE").await.unwrap().is_none());
    assert_eq!(vender(&db, 1).await, Err("VENDA_SEM_TURNO".into()));

    let _ = std::fs::remove_file(&path);
}

/// Atualização com turno aberto: o turno que já existia (sem `maquina`, aberto
/// antes da m014) é adotado no boot — o operador **continua nele**, sem partir o
/// caixa do dia nem reiniciar o Pedido Nº. Turno encerrado não é adotado.
#[tokio::test]
async fn turno_aberto_na_atualizacao_e_adotado_por_esta_maquina() {
    let (db, path) = setup("adota").await;
    let turnos = SeaTurnoRepo::new(db.clone());

    // Estado pré-013: um turno aberto e um encerrado, ambos sem máquina.
    let legado = turnos.abrir("op-1", 5000, "").await.unwrap().sync_uid;
    let encerrado = turnos.abrir("op-1", 0, "").await.unwrap().sync_uid;
    turnos.encerrar(&encerrado, 0, 0, 0).await.unwrap();
    db.execute(Statement::from_string(
        db.get_database_backend(),
        "UPDATE turno_operacao SET maquina = NULL".to_string(),
    ))
    .await
    .unwrap();
    // …e um turno ABERTO do Escritório, que desceu pela réplica (nunca é deste PC).
    let do_escritorio = turnos.abrir("op-esc", 0, "").await.unwrap().sync_uid;
    db.execute(Statement::from_sql_and_values(
        db.get_database_backend(),
        "UPDATE turno_operacao SET maquina = NULL, origem = 'escritorio' WHERE sync_uid = ?",
        [do_escritorio.clone().into()],
    ))
    .await
    .unwrap();
    assert!(turnos.turno_aberto_na_maquina("PDV-TESTE").await.unwrap().is_none());

    // Boot: adota só o aberto do PDV — nem o encerrado, nem o do escritório.
    let n = turno::adotar_turnos_legados(&turnos, &common::MaquinaTeste).await.unwrap();
    assert_eq!(n, 1, "só o turno aberto desta origem é adotado");
    let esc_maquina: Option<String> = db
        .query_one(Statement::from_sql_and_values(
            db.get_database_backend(),
            "SELECT maquina FROM turno_operacao WHERE sync_uid = ?",
            [do_escritorio.into()],
        ))
        .await
        .unwrap()
        .and_then(|r| r.try_get("", "maquina").ok());
    assert_eq!(esc_maquina, None, "o turno do escritório não é sequestrado pelo PDV");

    let atual = turnos.turno_aberto_na_maquina("PDV-TESTE").await.unwrap().unwrap();
    assert_eq!(atual.sync_uid, legado, "é o MESMO turno, não um novo");
    assert_eq!(atual.caixa_inicial_centavos, 5000, "o caixa do turno é preservado");

    // A venda seguinte entra no turno de sempre.
    let p = vender(&db, 1).await.unwrap();
    assert_eq!(vinculo(&db, p).await, (Some(legado), Some(1)));

    // Idempotente: rodar de novo não adota mais nada.
    assert_eq!(turno::adotar_turnos_legados(&turnos, &common::MaquinaTeste).await.unwrap(), 0);

    let _ = std::fs::remove_file(&path);
}

/// FR-003: cancelamento só da venda do turno aberto; a do turno encerrado é
/// recusada com orientação de corrigir no escritório.
#[tokio::test]
async fn cancelamento_so_do_turno_aberto() {
    let (db, path) = setup("cancela").await;
    let pedidos = SeaPedidoRepo::new(db.clone());
    let turnos = SeaTurnoRepo::new(db.clone());

    let t1 = turno::abrir_ou_continuar(&turnos, &common::MaquinaTeste, "op-1", 0).await.unwrap();
    let antiga = vender(&db, 1).await.unwrap();
    turnos.encerrar(&t1.sync_uid, 0, 0, 0).await.unwrap();

    turno::abrir_ou_continuar(&turnos, &common::MaquinaTeste, "op-1", 0).await.unwrap();
    let atual = vender(&db, 1).await.unwrap();

    let e = cancelamento::cancelar_venda(antiga, &pedidos, &turnos, &common::MaquinaTeste).await;
    assert_eq!(e.unwrap_err().codigo(), "VENDA_DE_TURNO_FECHADO");
    cancelamento::cancelar_venda(atual, &pedidos, &turnos, &common::MaquinaTeste).await.unwrap();

    // A venda do turno fechado continua íntegra; só a do turno aberto foi cancelada.
    let cancelados = db
        .query_all(Statement::from_string(
            db.get_database_backend(),
            "SELECT numero, cancelado FROM pedido ORDER BY numero".to_string(),
        ))
        .await
        .unwrap();
    let flags: Vec<(i64, i64)> = cancelados
        .iter()
        .map(|r| (r.try_get("", "numero").unwrap(), r.try_get("", "cancelado").unwrap()))
        .collect();
    assert_eq!(flags, vec![(antiga, 0), (atual, 1)]);

    let _ = std::fs::remove_file(&path);
}
