//! Teste de integração da razão de movimentos (Foundational, T018):
//! saldo inicial idempotente, reconciliação Σ movimentos == estoque após venda,
//! custo médio na entrada, ajuste não-negativo e imutabilidade (append-only).

use livraria_2_lib::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports::{LivroRepo, PedidoRepo};
use livraria_2_lib::application::ports_estoque::{EntradaCmd, EstoqueRepo};
use livraria_2_lib::domain::categoria::Categoria;
use livraria_2_lib::domain::dinheiro::Dinheiro;
use livraria_2_lib::domain::livro::Livro;
use livraria_2_lib::domain::pagamento::Turno;
use livraria_2_lib::domain::pedido::{ItemPedido, Pagamentos, Pedido};

fn url_temp() -> (String, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("livraria_estoquerepo_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
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
        data: "2026-06-23".into(),
        itens: vec![ItemPedido {
            codigo: codigo.into(),
            titulo: "A Cruz de Cristo".into(),
            preco: Dinheiro::de_centavos(3000),
            qtd,
        }],
        pagamentos: Pagamentos {
            cartao: Dinheiro::ZERO,
            dinheiro: Dinheiro::de_centavos(qtd * 3000),
            pix: Dinheiro::ZERO,
            ministerio: Dinheiro::ZERO,
            vale: Dinheiro::ZERO,
        },
    }
}

/// Saldo final == saldo_resultante do movimento mais recente (extrato vem desc).
async fn reconciliacao(estoque: &SeaEstoqueRepo, codigo: &str) -> i64 {
    estoque.extrato(codigo, 0).await.unwrap()[0].saldo_resultante
}

#[tokio::test]
async fn ledger_reconcilia_e_custo_medio() {
    let (url, path) = url_temp();
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let livros = SeaLivroRepo::new(db.clone());
    let pedidos = SeaPedidoRepo::new(db.clone());
    let estoque = SeaEstoqueRepo::new(db.clone());

    livros.salvar(&livro("111", 5)).await.unwrap();

    // Saldo inicial idempotente (FR-006).
    assert_eq!(estoque.gerar_saldos_iniciais().await.unwrap(), 1);
    assert_eq!(estoque.gerar_saldos_iniciais().await.unwrap(), 0);
    assert_eq!(reconciliacao(&estoque, "111").await, 5);

    // Venda baixa estoque e emite saida_venda (FR-003); reconciliação mantém (SC-001).
    pedidos.registrar(&venda_de("111", 2)).await.unwrap();
    assert_eq!(livros.por_codigo("111").await.unwrap().unwrap().estoque, 3);
    assert_eq!(reconciliacao(&estoque, "111").await, 3);

    // Entrada com custo médio ponderado (ADR-0009): estoque 3 @0 + 10 @1250 -> 962.
    let l = estoque
        .registrar_entrada(EntradaCmd {
            livro_codigo: "111".into(),
            qtd: 10,
            custo_unit_centavos: 1250,
            fornecedor: "Editora X".into(),
        })
        .await
        .unwrap();
    assert_eq!(l.estoque, 13);
    assert_eq!(l.custo_medio.centavos(), 962);
    assert_eq!(reconciliacao(&estoque, "111").await, 13);

    // Ajuste com motivo reduz; ajuste que zeraria abaixo de 0 é barrado no caso de uso,
    // mas o repo aplica o delta validado — aqui validamos a aplicação positiva/negativa.
    let l = estoque.registrar_ajuste("111", -1, "quebra").await.unwrap();
    assert_eq!(l.estoque, 12);
    assert_eq!(reconciliacao(&estoque, "111").await, 12);

    // Imutabilidade / append-only (FR-005): saldo_inicial + saida_venda + entrada + ajuste = 4 linhas.
    let extrato = estoque.extrato("111", 0).await.unwrap();
    assert_eq!(extrato.len(), 4);

    // Fornecedor sugerido a partir da entrada (FR-012).
    let sugestoes = estoque.fornecedores_sugestoes("Edit", 5).await.unwrap();
    assert_eq!(sugestoes, vec!["Editora X".to_string()]);

    let _ = std::fs::remove_file(&path);
}
