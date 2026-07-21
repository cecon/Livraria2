//! Testes de integração do consumo de carimbos (US2 — FR-008..013):
//! venda consome carimbos em ordem (Loja 1ª) → livre; perdas/estornos fazem o
//! inverso; estorno de venda devolve ao carimbo certo; janela de 5 dias;
//! relatório + posição atual fecham com o total (SC-003/SC-004).

use livraria_2_lib::adapters::persistencia::destinacao_repo::SeaDestinacaoRepo;
use livraria_2_lib::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use livraria_2_lib::adapters::persistencia::fornecedor_repo::SeaFornecedorRepo;
use livraria_2_lib::adapters::persistencia::lancamento_repo::SeaLancamentoRepo;
use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use livraria_2_lib::adapters::persistencia::relatorio_repo::SeaRelatorioRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::destinacoes as dest;
use livraria_2_lib::application::erros::ErroApp;
use livraria_2_lib::application::ports::{
    LivroRepo, PedidoRepo, Relogio, RelatorioRepo,
};
use livraria_2_lib::application::ports_compras::{FornecedorRepo, LancamentoRepo};
use livraria_2_lib::application::ports_destinacao::DestinacaoRepo;
use livraria_2_lib::application::ports_estoque::EstoqueRepo;
use livraria_2_lib::application::cancelamento;
use livraria_2_lib::domain::categoria::Categoria;
use livraria_2_lib::domain::dinheiro::Dinheiro;
use livraria_2_lib::domain::livro::Livro;
use livraria_2_lib::domain::pagamento::Turno;
use livraria_2_lib::domain::pedido::{ItemPedido, Pedido, Recebimento};
use sea_orm::DatabaseConnection;

fn url_temp(tag: &str) -> (String, std::path::PathBuf) {
    let path =
        std::env::temp_dir().join(format!("livraria_consumo_{}_{tag}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

struct RelogioFixo;
impl Relogio for RelogioFixo {
    fn hora_atual(&self) -> u32 {
        10
    }
    fn hoje_iso(&self) -> String {
        "2026-07-05".to_string()
    }
}

async fn setup(tag: &str) -> (DatabaseConnection, std::path::PathBuf) {
    let (url, path) = url_temp(tag);
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    (db, path)
}

async fn semear_livro(db: &DatabaseConnection, codigo: &str, estoque: i64, preco: i64) {
    SeaLivroRepo::new(db.clone())
        .salvar(&Livro {
            codigo: codigo.into(),
            titulo: "A Cruz de Cristo".into(),
            autor: None,
            preco: Dinheiro::de_centavos(preco),
            categoria: Categoria::Biblias,
            estoque,
            descricao: None,
            custo_medio: Dinheiro::ZERO,
        })
        .await
        .unwrap();
}

fn pedido(numero: i64, data: &str, codigo: &str, qtd: i64, preco: i64) -> Pedido {
    Pedido {
        numero,
        cliente: "CLIENTE".into(),
        turno: Turno::de_hora(10),
        operador: None,
        data: data.into(),
        itens: vec![ItemPedido {
            codigo: codigo.into(),
            titulo: "A Cruz de Cristo".into(),
            preco: Dinheiro::de_centavos(preco),
            qtd,
        }],
        pagamentos: vec![Recebimento {
            forma_id: 3, // "dinheiro" (seed determinístico da m006)
            valor: Dinheiro::de_centavos(qtd * preco),
        }],
    }
}

async fn carimbo(repo: &SeaDestinacaoRepo, codigo: &str, para: i64, qtd: i64) {
    dest::transferir(codigo, None, Some(para), qtd, None, repo)
        .await
        .unwrap();
}

fn qtd_de(s: &livraria_2_lib::application::ports_destinacao::SaldoLivro, id: i64) -> i64 {
    s.carimbos
        .iter()
        .find(|c| c.destinacao_id == id)
        .map(|c| c.qtd)
        .unwrap_or(0)
}

#[tokio::test]
async fn venda_na_fronteira_estorno_e_relatorio() {
    let (db, path) = setup("venda").await;
    let repo = SeaDestinacaoRepo::new(db.clone());
    let pedidos = SeaPedidoRepo::new(db.clone());

    // Livro 80 un. × R$ 50; carimbos Loja 1 + Missões 70 (livre 9).
    // Ordem de baixa da venda: Loja → Missões → livre.
    semear_livro(&db, "111", 80, 5000).await;
    let loja_id = dest::listar(&repo).await.unwrap()[0].id;
    let missoes = dest::criar("Missões", &repo).await.unwrap();
    carimbo(&repo, "111", loja_id, 1).await;
    carimbo(&repo, "111", missoes.id, 70).await;

    // Vende 2: 1 do carimbo Loja + 1 de Missões (fronteira — US2 cenário 2/3).
    pedidos.registrar(&pedido(1, "2026-07-05", "111", 2, 5000)).await.unwrap();
    let s = dest::saldos_livro("111", &repo).await.unwrap();
    assert_eq!(s.estoque, 78);
    assert_eq!(qtd_de(&s, loja_id), 0);
    assert_eq!(qtd_de(&s, missoes.id), 69);

    // Detalhe da venda: 1 un. Loja + 1 un. Missões, R$ 50 cada (FR-013).
    let vendas = SeaRelatorioRepo::new(db.clone()).vendas("2026-07-05", "dia").await.unwrap();
    let alocs = &vendas[0].itens[0].alocacoes;
    assert_eq!(alocs.len(), 2);
    assert_eq!((alocs[0].nome.as_str(), alocs[0].qtd, alocs[0].valor_centavos), ("Loja", 1, 5000));
    assert_eq!((alocs[1].nome.as_str(), alocs[1].qtd), ("Missões", 1));

    // Relatório: Σ linhas = total (SC-003); posição atual Missões 69 (FR-018).
    let r = dest::relatorio("2026-07-05", "2026-07-05", &repo).await.unwrap();
    assert_eq!(r.total_centavos, 10000);
    assert_eq!(r.linhas.iter().map(|l| l.valor_centavos).sum::<i64>(), r.total_centavos);
    assert_eq!(r.linhas[0].nome, "Loja");
    assert_eq!(r.linhas[0].valor_centavos, 5000);
    assert_eq!(r.posicao_atual.iter().find(|p| p.destinacao_id == missoes.id).unwrap().qtd, 69);

    // Repasse do fechamento: só destinações especiais (a Loja não é repasse).
    let rep = repo.repasse("2026-07-05", "dia").await.unwrap();
    assert_eq!(rep.len(), 1);
    assert_eq!((rep[0].nome.as_str(), rep[0].qtd, rep[0].valor_centavos), ("Missões", 1, 5000));
    assert_eq!(rep[0].livros[0].titulo, "A Cruz de Cristo");

    // Estorno (mesmo dia): devolve ao carimbo certo, inclusive Loja (FR-010/SC-004).
    cancelamento::cancelar_venda(1, &pedidos, &RelogioFixo).await.unwrap();
    let s = dest::saldos_livro("111", &repo).await.unwrap();
    assert_eq!(s.estoque, 80);
    assert_eq!(qtd_de(&s, loja_id), 1);
    assert_eq!(qtd_de(&s, missoes.id), 70);
    // Retroativo no relatório + idempotente (2º cancelamento não duplica).
    cancelamento::cancelar_venda(1, &pedidos, &RelogioFixo).await.unwrap();
    let r = dest::relatorio("2026-07-05", "2026-07-05", &repo).await.unwrap();
    assert_eq!(r.total_centavos, 0);
    assert_eq!(qtd_de(&dest::saldos_livro("111", &repo).await.unwrap(), loja_id), 1);

    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn venda_sem_carimbo_nao_gera_linhas() {
    let (db, path) = setup("livre").await;
    let repo = SeaDestinacaoRepo::new(db.clone());
    let pedidos = SeaPedidoRepo::new(db.clone());
    semear_livro(&db, "222", 50, 3000).await;

    pedidos.registrar(&pedido(1, "2026-07-05", "222", 3, 3000)).await.unwrap();
    let vendas = SeaRelatorioRepo::new(db.clone()).vendas("2026-07-05", "dia").await.unwrap();
    assert!(vendas[0].itens[0].alocacoes.is_empty(), "livre não gera alocação (D3)");
    let r = dest::relatorio("2026-07-05", "2026-07-05", &repo).await.unwrap();
    assert_eq!(r.linhas.len(), 1); // só Loja (derivada)
    assert_eq!(r.linhas[0].valor_centavos, 9000);

    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn venda_antiga_bloqueada_apos_5_dias() {
    let (db, path) = setup("antiga").await;
    let pedidos = SeaPedidoRepo::new(db.clone());
    semear_livro(&db, "333", 10, 2000).await;
    pedidos.registrar(&pedido(1, "2026-06-20", "333", 1, 2000)).await.unwrap(); // 15 dias atrás
    pedidos.registrar(&pedido(2, "2026-07-01", "333", 1, 2000)).await.unwrap(); // 4 dias atrás

    let e = cancelamento::cancelar_venda(1, &pedidos, &RelogioFixo).await;
    match e {
        Err(ErroApp::Dominio(d)) => assert_eq!(d.codigo(), "VENDA_ANTIGA"),
        outro => panic!("esperava VENDA_ANTIGA, veio {outro:?}"),
    }
    cancelamento::cancelar_venda(2, &pedidos, &RelogioFixo).await.unwrap(); // dentro da janela

    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn perdas_protegem_carimbos_ajuste_e_estorno_de_nota() {
    let (db, path) = setup("perdas").await;
    let repo = SeaDestinacaoRepo::new(db.clone());
    let estoque = SeaEstoqueRepo::new(db.clone());
    let missoes = dest::criar("Missões", &repo).await.unwrap();

    // Ajuste negativo: livre 5 + Missões 10 → perda de 3 não toca Missões (FR-012).
    semear_livro(&db, "444", 15, 2000).await;
    carimbo(&repo, "444", missoes.id, 10).await;
    estoque.registrar_ajuste("444", -3, "quebra").await.unwrap();
    let s = dest::saldos_livro("444", &repo).await.unwrap();
    assert_eq!((s.estoque, s.livre, qtd_de(&s, missoes.id)), (12, 2, 10));
    // Perda além do livre avança pelos carimbos.
    estoque.registrar_ajuste("444", -11, "quebra maior").await.unwrap();
    let s = dest::saldos_livro("444", &repo).await.unwrap();
    assert_eq!((s.estoque, s.livre, qtd_de(&s, missoes.id)), (1, 0, 1));
    // Ajuste positivo entra como livre.
    estoque.registrar_ajuste("444", 4, "achado").await.unwrap();
    let s = dest::saldos_livro("444", &repo).await.unwrap();
    assert_eq!((s.livre, qtd_de(&s, missoes.id)), (4, 1));

    // Estorno de nota de entrada consome como perda (edge case da spec).
    let lanc = SeaLancamentoRepo::new(db.clone());
    semear_livro(&db, "555", 0, 2000).await;
    let doador = SeaFornecedorRepo::new(db.clone())
        .salvar(&livraria_2_lib::domain::fornecedor::Fornecedor {
            id: 0,
            nome: "Doações".into(),
            documento: None,
            telefone: None,
            email: None,
            observacoes: None,
            ativo: true,
        })
        .await
        .unwrap();
    let nota = lanc.criar(Some(doador.id)).await.unwrap();
    lanc.adicionar_item(nota.id, "555", 10, 0).await.unwrap();
    livraria_2_lib::application::lancamentos::finalizar(nota.id, &lanc).await.unwrap();
    carimbo(&repo, "555", missoes.id, 8).await; // 8 carimbadas, 2 livres
    livraria_2_lib::application::lancamentos::cancelar(nota.id, &lanc).await.unwrap();
    let s = dest::saldos_livro("555", &repo).await.unwrap();
    assert_eq!((s.estoque, s.livre, qtd_de(&s, missoes.id)), (0, 0, 0));

    let _ = std::fs::remove_file(&path);
}
