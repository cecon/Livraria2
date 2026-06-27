//! Teste de integração do LancamentoRepo (US2, T019): finalizar gera entrada por
//! item, reconciliação Σ==estoque, idempotência e item repetido soma na linha.

use livraria_2_lib::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use livraria_2_lib::adapters::persistencia::fornecedor_repo::SeaFornecedorRepo;
use livraria_2_lib::adapters::persistencia::lancamento_repo::SeaLancamentoRepo;
use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports::LivroRepo;
use livraria_2_lib::application::ports_compras::{FornecedorRepo, LancamentoRepo};
use livraria_2_lib::application::ports_estoque::EstoqueRepo;
use livraria_2_lib::domain::categoria::Categoria;
use livraria_2_lib::domain::dinheiro::Dinheiro;
use livraria_2_lib::domain::fornecedor::Fornecedor;
use livraria_2_lib::domain::livro::Livro;

fn url_temp(tag: &str) -> (String, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("livraria_lanc_{}_{tag}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

fn livro(codigo: &str, estoque: i64) -> Livro {
    Livro {
        codigo: codigo.into(),
        titulo: format!("Livro {codigo}"),
        autor: None,
        preco: Dinheiro::de_centavos(3000),
        categoria: Categoria::Biblias,
        estoque,
        descricao: None,
        custo_medio: Dinheiro::ZERO,
    }
}

async fn estoque_de(l: &SeaLivroRepo, c: &str) -> i64 {
    l.por_codigo(c).await.unwrap().unwrap().estoque
}

async fn soma_mov(e: &SeaEstoqueRepo, c: &str) -> i64 {
    // saldo_resultante do movimento mais recente == Σ movimentos
    e.extrato(c, 0).await.unwrap()[0].saldo_resultante
}

#[tokio::test]
async fn finaliza_reconcilia_e_idempotente() {
    let (url, path) = url_temp("finaliza");
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let livros = SeaLivroRepo::new(db.clone());
    let estoque = SeaEstoqueRepo::new(db.clone());
    let forn = SeaFornecedorRepo::new(db.clone());
    let lanc = SeaLancamentoRepo::new(db.clone());

    livros.salvar(&livro("A", 5)).await.unwrap();
    livros.salvar(&livro("B", 0)).await.unwrap();
    estoque.gerar_saldos_iniciais().await.unwrap();

    let f = forn
        .salvar(&Fornecedor {
            id: 0,
            nome: "Editora X".into(),
            documento: None,
            telefone: None,
            email: None,
            observacoes: None,
            ativo: true,
        })
        .await
        .unwrap();

    let nota = lanc.criar(Some(f.id)).await.unwrap();
    // item repetido (A) soma na mesma linha: 10 + 5 = 15
    lanc.adicionar_item(nota.id, "A", 10, 1250).await.unwrap();
    let d = lanc.adicionar_item(nota.id, "A", 5, 1300).await.unwrap();
    assert_eq!(d.itens.len(), 1);
    assert_eq!(d.itens[0].qtd, 15);
    lanc.adicionar_item(nota.id, "B", 3, 1000).await.unwrap();

    // finalizar → estoque sobe e reconcilia
    lanc.finalizar(nota.id).await.unwrap();
    assert_eq!(estoque_de(&livros, "A").await, 20); // 5 + 15
    assert_eq!(estoque_de(&livros, "B").await, 3);
    assert_eq!(soma_mov(&estoque, "A").await, 20); // SC-001
    assert_eq!(soma_mov(&estoque, "B").await, 3);

    // idempotente: finalizar de novo não reaplica
    let again = lanc.finalizar(nota.id).await.unwrap();
    assert_eq!(again.status, "finalizada");
    assert_eq!(estoque_de(&livros, "A").await, 20);

    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn cancelar_estorna_e_bloqueia_se_consumido() {
    let (url, path) = url_temp("cancelar");
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let livros = SeaLivroRepo::new(db.clone());
    let estoque = SeaEstoqueRepo::new(db.clone());
    let forn = SeaFornecedorRepo::new(db.clone());
    let lanc = SeaLancamentoRepo::new(db.clone());

    livros.salvar(&livro("A", 0)).await.unwrap();
    estoque.gerar_saldos_iniciais().await.unwrap();
    let f = forn
        .salvar(&Fornecedor {
            id: 0,
            nome: "Editora X".into(),
            documento: None,
            telefone: None,
            email: None,
            observacoes: None,
            ativo: true,
        })
        .await
        .unwrap();

    // Nota 1: entra 5 e finaliza.
    let n1 = lanc.criar(Some(f.id)).await.unwrap();
    lanc.adicionar_item(n1.id, "A", 5, 1000).await.unwrap();
    lanc.finalizar(n1.id).await.unwrap();
    assert_eq!(estoque_de(&livros, "A").await, 5);

    // Cancela → estorna (estoque 0) e reconcilia (saldo_inicial 0 + entrada 5 + estorno -5).
    let d = lanc.cancelar(n1.id).await.unwrap();
    assert_eq!(d.status, "cancelada");
    assert_eq!(estoque_de(&livros, "A").await, 0);
    assert_eq!(soma_mov(&estoque, "A").await, 0);
    // idempotente
    lanc.cancelar(n1.id).await.unwrap();
    assert_eq!(estoque_de(&livros, "A").await, 0);

    // Nota 2: entra 3, vende 2 (ajuste), cancelar deve ser BLOQUEADO (estoque consumido).
    let n2 = lanc.criar(Some(f.id)).await.unwrap();
    lanc.adicionar_item(n2.id, "A", 3, 1000).await.unwrap();
    lanc.finalizar(n2.id).await.unwrap();
    estoque.registrar_ajuste("A", -2, "venda").await.unwrap(); // estoque 1
    assert!(lanc.cancelar(n2.id).await.is_err());
    assert_eq!(estoque_de(&livros, "A").await, 1); // inalterado pelo cancel bloqueado

    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn rascunho_nao_afeta_estoque_e_excluir() {
    let (url, path) = url_temp("rascunho");
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let livros = SeaLivroRepo::new(db.clone());
    let estoque = SeaEstoqueRepo::new(db.clone());
    let lanc = SeaLancamentoRepo::new(db.clone());

    livros.salvar(&livro("A", 5)).await.unwrap();
    estoque.gerar_saldos_iniciais().await.unwrap();

    let nota = lanc.criar(None).await.unwrap();
    lanc.adicionar_item(nota.id, "A", 10, 1250).await.unwrap();
    // rascunho (não finalizado) → estoque intacto (FR-022)
    assert_eq!(estoque_de(&livros, "A").await, 5);

    // excluir rascunho → some e nada lançado
    lanc.excluir(nota.id).await.unwrap();
    assert!(lanc.obter(nota.id).await.unwrap().is_none());
    assert_eq!(estoque_de(&livros, "A").await, 5);

    let _ = std::fs::remove_file(&path);
}
