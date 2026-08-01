//! Teste de integração da venda (US1, SC-002): persiste pedido e baixa estoque.

mod common;

use livraria_2_lib::adapters::persistencia::forma_pagamento_repo::SeaFormaPagamentoRepo;
use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports::{FormaPagamentoRepo, LivroRepo};
use livraria_2_lib::application::venda::{registrar_venda, ItemInput, RecebimentoInput, VendaInput};
use livraria_2_lib::domain::categoria::Categoria;
use livraria_2_lib::domain::dinheiro::Dinheiro;
use livraria_2_lib::domain::livro::Livro;
use livraria_2_lib::domain::pagamento::Turno;
use livraria_2_lib::application::ports::Relogio;
use livraria_2_lib::commands_turno::pendencias_sync_turno;
use sea_orm::{ConnectionTrait, Statement};

struct RelogioFixo;
impl Relogio for RelogioFixo {
    fn hora_atual(&self) -> u32 {
        15
    }
    fn hoje_iso(&self) -> String {
        "2026-06-14".to_string()
    }
}

fn url_temp() -> (String, std::path::PathBuf) {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path = std::env::temp_dir().join(format!("livraria_venda_{}_{}.db", std::process::id(), nanos));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

#[tokio::test]
async fn venda_persiste_e_baixa_estoque() {
    let (url, path) = url_temp();
    let db = conectar(&url).await.expect("conectar");
    inicializar_schema(&db).await.expect("migrar");
    common::semear_formas(&db).await; // feature 012: as formas viriam da nuvem

    let livros = SeaLivroRepo::new(db.clone());
    let pedidos = SeaPedidoRepo::new(db.clone());
    let formas = SeaFormaPagamentoRepo::new(db.clone());

    // m006 semeou o cadastro no boot: resolve a forma Dinheiro pela chave.
    let dinheiro = formas.por_chave("dinheiro").await.unwrap().unwrap();

    // Semeia um livro com estoque 10.
    livros
        .salvar(&Livro {
            codigo: "9788573671469".into(),
            titulo: "A Cruz de Cristo".into(),
            autor: Some("John Stott".into()),
            preco: Dinheiro::de_centavos(3000),
            categoria: Categoria::EstudoTeologia,
            estoque: 10,
            descricao: None,
            custo_medio: Dinheiro::ZERO,
        })
        .await
        .expect("semear");

    let input = VendaInput {
        operador: None,
        cliente: "".into(),
        itens: vec![ItemInput {
            codigo: "9788573671469".into(),
            qtd: 3,
        }],
        pagamentos: vec![RecebimentoInput {
            forma_id: dinheiro.id,
            valor_centavos: 9000,
        }],
    };

    let pedido = registrar_venda(input, &livros, &pedidos, &formas, &RelogioFixo)
        .await
        .expect("registrar venda");

    assert_eq!(pedido.numero, 1, "primeiro pedido começa em 1");
    assert_eq!(pedido.turno, Turno::Tarde, "15h -> tarde");
    assert_eq!(pedido.total().centavos(), 9000);

    // Estoque baixou de 10 para 7.
    let atual = livros.por_codigo("9788573671469").await.unwrap().unwrap();
    assert_eq!(atual.estoque, 7, "estoque deve baixar pela qtd vendida");

    let rows = db
        .query_all(Statement::from_string(
            db.get_database_backend(),
            "SELECT estoque_status AS s FROM pedido WHERE numero = 1".to_string(),
        ))
        .await
        .unwrap();
    let status: String = rows[0].try_get("", "s").unwrap();
    assert_eq!(status, "pronta", "venda local concluida deve sincronizar como pronta");

    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn resumo_turno_conta_vendas_pagamentos_e_pendencias_sync() {
    let (url, path) = url_temp();
    let db = conectar(&url).await.expect("conectar");
    inicializar_schema(&db).await.expect("migrar");
    common::semear_formas(&db).await; // feature 012: as formas viriam da nuvem

    let forma_id = db
        .query_one(Statement::from_string(
            db.get_database_backend(),
            "SELECT id AS id FROM forma_pagamento WHERE chave='dinheiro' LIMIT 1".to_string(),
        ))
        .await
        .unwrap()
        .and_then(|r| r.try_get::<i64>("", "id").ok())
        .unwrap();

    db.execute(Statement::from_string(
        db.get_database_backend(),
        "INSERT INTO turno_operacao (sync_uid,operador,caixa_inicial_centavos,status,abertura,atualizado_em) \
         VALUES ('turno-1','op',1000,'aberto','2026-07-28T09:00:00','2026-07-28T09:00:00')"
            .to_string(),
    ))
    .await
    .unwrap();
    db.execute(Statement::from_string(
        db.get_database_backend(),
        "INSERT INTO pedido (numero,cliente,turno,data,total_centavos,turno_uid,numero_no_turno,estoque_status) \
         VALUES (7001,'C','manha','2026-07-28',1500,'turno-1',1,'pronta')"
            .to_string(),
    ))
    .await
    .unwrap();
    db.execute(Statement::from_string(
        db.get_database_backend(),
        "INSERT INTO item_pedido (pedido_numero,codigo,titulo,preco_centavos,qtd) \
         VALUES (7001,'X','Livro X',1500,1)"
            .to_string(),
    ))
    .await
    .unwrap();
    db.execute(Statement::from_string(
        db.get_database_backend(),
        format!("INSERT INTO pagamento_pedido (pedido_numero,forma_id,valor_centavos) VALUES (7001,{forma_id},1500)"),
    ))
    .await
    .unwrap();

    let pendencias = pendencias_sync_turno(&db, "turno-1").await.unwrap();
    assert_eq!(pendencias, 4, "turno, pedido, item e pagamento ainda pendentes");

    let _ = std::fs::remove_file(&path);
}
