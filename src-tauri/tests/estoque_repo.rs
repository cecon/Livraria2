//! Teste de integração da razão de movimentos (Foundational, T018):
//! saldo operacional (feature 011), saldo inicial idempotente e reparo de
//! baseline (ADR-0017). Entrada/ajuste são contabilidade oficial da nuvem (012).

mod common;

use livraria_2_lib::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports::{LivroRepo, PedidoRepo};
use livraria_2_lib::application::ports_estoque::EstoqueRepo;
use livraria_2_lib::domain::categoria::Categoria;
use livraria_2_lib::domain::dinheiro::Dinheiro;
use livraria_2_lib::domain::livro::Livro;
use livraria_2_lib::domain::pagamento::Turno;
use livraria_2_lib::domain::pedido::{ItemPedido, Pedido, Recebimento};
use sea_orm::{ConnectionTrait, Statement};

fn url_temp(nome: &str) -> (String, std::path::PathBuf) {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path = std::env::temp_dir()
        .join(format!("livraria_estoquerepo_{}_{}_{}.db", std::process::id(), nome, nanos));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

#[tokio::test]
async fn saldo_operacional_usa_publicado_menos_vendas_e_mais_cancelamentos_nao_sinc() {
    let (url, path) = url_temp("saldo_operacional");
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    common::semear_formas(&db).await; // feature 012: as formas viriam da nuvem
    let backend = db.get_database_backend();

    db.execute(Statement::from_string(
        backend,
        "INSERT INTO livro (codigo,titulo,saldo_publicado) VALUES ('333','Saldo simples',10)".to_string(),
    ))
    .await
    .unwrap();
    db.execute(Statement::from_string(
        backend,
        "INSERT INTO pedido (numero,cliente,turno,data,total_centavos,cancelado,estoque_status) VALUES
         (8001,'C','manha','2026-07-28',2000,0,'pronta'),
         (8002,'C','manha','2026-07-28',1000,1,'pronta')"
            .to_string(),
    ))
    .await
    .unwrap();
    db.execute(Statement::from_string(
        backend,
        "INSERT INTO item_pedido (pedido_numero,codigo,titulo,preco_centavos,qtd) VALUES
         (8001,'333','Saldo simples',1000,2),
         (8002,'333','Saldo simples',1000,1)"
            .to_string(),
    ))
    .await
    .unwrap();

    let saldo = SeaEstoqueRepo::new(db.clone()).saldo_operacional("333").await.unwrap();
    assert_eq!(saldo, 9);

    let _ = std::fs::remove_file(&path);
}

fn livro(codigo: &str, estoque: i64) -> Livro {
    Livro {
        codigo: codigo.into(),
        titulo: "A Cruz de Cristo".into(),
        autor: Some("John Stott".into()),
        preco: Dinheiro::de_centavos(3000),
        categoria: Categoria::Biblias,
        estoque,
        descricao: None,
        custo_medio: Dinheiro::ZERO,
    }
}

fn venda_de(codigo: &str, qtd: i64) -> Pedido {
    Pedido {
        numero: 1,
        cliente: "CLIENTE".into(),
        turno: Turno::de_hora(10),
        operador: None,
        data: "2026-06-23".into(),
        itens: vec![ItemPedido {
            codigo: codigo.into(),
            titulo: "A Cruz de Cristo".into(),
            preco: Dinheiro::de_centavos(3000),
            qtd,
        }],
        // id 3 = "dinheiro" (seed determinístico da m006 em base nova)
        pagamentos: vec![Recebimento {
            forma_id: 3,
            valor: Dinheiro::de_centavos(qtd * 3000),
        }],
    }
}

/// Σ das quantidades do ledger (independente de ordem).
async fn soma_movimentos(estoque: &SeaEstoqueRepo, codigo: &str) -> i64 {
    estoque.extrato(codigo, 0).await.unwrap().iter().map(|m| m.qtd).sum()
}

/// ADR-0017: livro herdado do legado com movimento de venda mas SEM `saldo_inicial`
/// (Σ ≠ estoque, como o A PONTE de produção) é reparado por `adotar` — cria o baseline
/// `estoque − Σ`, restaurando `Σ == estoque` sem tocar no estoque cacheado.
#[tokio::test]
async fn adotar_repara_livro_com_movimento_sem_saldo_inicial() {
    let (url, path) = url_temp("repara");
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    common::semear_formas(&db).await; // feature 012: as formas viriam da nuvem
    let livros = SeaLivroRepo::new(db.clone());
    let pedidos = SeaPedidoRepo::new(db.clone());
    let estoque = SeaEstoqueRepo::new(db.clone());

    // Estoque 128 e uma venda de 2 ANTES da adoção → há `saida_venda` mas nenhum
    // `saldo_inicial`. Σ = -2, estoque = 126: ledger incompleto (Σ ≠ estoque).
    livros.salvar(&livro("222", 128)).await.unwrap();
    pedidos.registrar(&venda_de("222", 2)).await.unwrap();
    assert_eq!(livros.por_codigo("222").await.unwrap().unwrap().estoque, 126);
    assert_eq!(soma_movimentos(&estoque, "222").await, -2);

    // adotar repara: 1 baseline (= 126 − (−2) = 128), Σ passa a bater com o estoque…
    assert_eq!(estoque.gerar_saldos_iniciais().await.unwrap(), 1);
    assert_eq!(soma_movimentos(&estoque, "222").await, 126);
    // …sem alterar o estoque cacheado.
    assert_eq!(livros.por_codigo("222").await.unwrap().unwrap().estoque, 126);

    // Idempotente: segunda passada não cria nada.
    assert_eq!(estoque.gerar_saldos_iniciais().await.unwrap(), 0);

    let _ = std::fs::remove_file(&path);
}
