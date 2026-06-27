//! Teste de integração da venda (US1, SC-002): persiste pedido e baixa estoque.

use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports::LivroRepo;
use livraria_2_lib::application::venda::{registrar_venda, ItemInput, PagamentosInput, VendaInput};
use livraria_2_lib::domain::categoria::Categoria;
use livraria_2_lib::domain::dinheiro::Dinheiro;
use livraria_2_lib::domain::livro::Livro;
use livraria_2_lib::domain::pagamento::Turno;
use livraria_2_lib::application::ports::Relogio;

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
    let path = std::env::temp_dir().join(format!("livraria_venda_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

#[tokio::test]
async fn venda_persiste_e_baixa_estoque() {
    let (url, path) = url_temp();
    let db = conectar(&url).await.expect("conectar");
    inicializar_schema(&db).await.expect("migrar");

    let livros = SeaLivroRepo::new(db.clone());
    let pedidos = SeaPedidoRepo::new(db.clone());

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
        cliente: "".into(),
        itens: vec![ItemInput {
            codigo: "9788573671469".into(),
            qtd: 3,
        }],
        pagamentos: PagamentosInput {
            dinheiro: 9000,
            ..Default::default()
        },
    };

    let pedido = registrar_venda(input, &livros, &pedidos, &RelogioFixo)
        .await
        .expect("registrar venda");

    assert_eq!(pedido.numero, 1, "primeiro pedido começa em 1");
    assert_eq!(pedido.turno, Turno::Tarde, "15h -> tarde");
    assert_eq!(pedido.total().centavos(), 9000);

    // Estoque baixou de 10 para 7.
    let atual = livros.por_codigo("9788573671469").await.unwrap().unwrap();
    assert_eq!(atual.estoque, 7, "estoque deve baixar pela qtd vendida");

    let _ = std::fs::remove_file(&path);
}
