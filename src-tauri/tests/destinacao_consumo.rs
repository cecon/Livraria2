//! Testes de integração do consumo de carimbos (US2 — FR-008..013):
//! venda consome carimbos em ordem (Loja 1ª) → livre; perdas/estornos fazem o
//! inverso; estorno de venda devolve ao carimbo certo; janela de 5 dias;
//! relatório + posição atual fecham com o total (SC-003/SC-004).
//!
//! Feature 012 ("a nuvem manda"): o CADASTRO de destinação e a operação de
//! DESTINAR (transferir carimbos) saíram do PDV — vivem na nuvem. Os testes
//! montam o estado pós-sync direto no banco (helpers SQL locais abaixo) e
//! exercitam a mecânica que PERMANECE local: consumo na venda/perda e estorno.

mod common;

use livraria_2_lib::adapters::persistencia::destinacao_repo::SeaDestinacaoRepo;
use livraria_2_lib::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use livraria_2_lib::adapters::persistencia::relatorio_repo::SeaRelatorioRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::cancelamento;
use livraria_2_lib::application::destinacoes as dest;
use livraria_2_lib::application::erros::ErroApp;
use livraria_2_lib::application::ports::{LivroRepo, PedidoRepo, RelatorioRepo, Relogio};
use livraria_2_lib::application::ports_destinacao::DestinacaoRepo;
use livraria_2_lib::application::ports_estoque::EstoqueRepo;
use livraria_2_lib::domain::categoria::Categoria;
use livraria_2_lib::domain::dinheiro::Dinheiro;
use livraria_2_lib::domain::livro::Livro;
use livraria_2_lib::domain::pagamento::Turno;
use livraria_2_lib::domain::pedido::{ItemPedido, Pedido, Recebimento};
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};

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
    common::semear_loja(&db).await; // feature 012: Loja + formas viriam da nuvem
    common::semear_formas(&db).await;
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

// --- Helpers de carimbo (estado pós-sync montado direto no banco) --------------
// A nuvem entrega o cadastro de destinação e os carimbos já resolvidos; aqui
// reproduzimos esse estado com SQL, sem depender de comandos de edição no PDV.

async fn escalar(db: &DatabaseConnection, sql: &str, params: Vec<sea_orm::Value>) -> i64 {
    db.query_one(Statement::from_sql_and_values(db.get_database_backend(), sql, params))
        .await
        .unwrap()
        .map(|r| r.try_get::<i64>("", "v").unwrap())
        .unwrap_or(0)
}

/// Cria uma destinação especial (como se tivesse descido da nuvem) e retorna o id.
async fn criar_dest(db: &DatabaseConnection, nome: &str) -> i64 {
    db.execute(Statement::from_sql_and_values(
        db.get_database_backend(),
        "INSERT INTO destinacao (nome, nome_norm, de_sistema, ativa, ordem, sync_uid) \
         VALUES (?, ?, 0, 1, 1, lower(hex(randomblob(16))))",
        [nome.into(), nome.to_lowercase().into()],
    ))
    .await
    .unwrap();
    escalar(db, "SELECT id AS v FROM destinacao WHERE nome = ?", vec![nome.into()]).await
}

/// Id da destinação de sistema "Loja" (ordem 0).
async fn loja_id(db: &DatabaseConnection) -> i64 {
    escalar(
        db,
        "SELECT id AS v FROM destinacao WHERE de_sistema = 1 ORDER BY ordem, id LIMIT 1",
        vec![],
    )
    .await
}

/// Carimba `qtd` do livro para a destinação (upsert — mesma mecânica da nuvem).
async fn carimbo(db: &DatabaseConnection, codigo: &str, destinacao_id: i64, qtd: i64) {
    let livro_id =
        escalar(db, "SELECT id AS v FROM livro WHERE codigo = ?", vec![codigo.into()]).await;
    db.execute(Statement::from_sql_and_values(
        db.get_database_backend(),
        "INSERT INTO destinacao_saldo (livro_id, destinacao_id, qtd) VALUES (?, ?, ?) \
         ON CONFLICT(livro_id, destinacao_id) DO UPDATE SET qtd = qtd + excluded.qtd",
        [livro_id.into(), destinacao_id.into(), qtd.into()],
    ))
    .await
    .unwrap();
}

/// Estoque físico do livro.
async fn estoque_de(db: &DatabaseConnection, codigo: &str) -> i64 {
    escalar(db, "SELECT estoque AS v FROM livro WHERE codigo = ?", vec![codigo.into()]).await
}

/// Saldo livre: `estoque − Σ carimbos` (pertence à Loja por definição — D1).
async fn livre(db: &DatabaseConnection, codigo: &str) -> i64 {
    escalar(
        db,
        "SELECT (l.estoque - COALESCE(\
             (SELECT SUM(ds.qtd) FROM destinacao_saldo ds WHERE ds.livro_id = l.id), 0)) AS v \
         FROM livro l WHERE l.codigo = ?",
        vec![codigo.into()],
    )
    .await
}

/// Quantidade carimbada de um livro numa destinação (0 se não houver linha).
async fn carimbo_qtd(db: &DatabaseConnection, codigo: &str, destinacao_id: i64) -> i64 {
    escalar(
        db,
        "SELECT COALESCE((SELECT ds.qtd FROM destinacao_saldo ds \
             JOIN livro l ON l.id = ds.livro_id \
             WHERE l.codigo = ? AND ds.destinacao_id = ?), 0) AS v",
        vec![codigo.into(), destinacao_id.into()],
    )
    .await
}

#[tokio::test]
async fn venda_na_fronteira_estorno_e_relatorio() {
    let (db, path) = setup("venda").await;
    let repo = SeaDestinacaoRepo::new(db.clone());
    let pedidos = SeaPedidoRepo::new(db.clone());

    // Livro 80 un. × R$ 50; carimbos Loja 1 + Missões 70 (livre 9).
    // Ordem de baixa da venda: Loja → Missões → livre.
    semear_livro(&db, "111", 80, 5000).await;
    let loja = loja_id(&db).await;
    let missoes = criar_dest(&db, "Missões").await;
    carimbo(&db, "111", loja, 1).await;
    carimbo(&db, "111", missoes, 70).await;

    // Vende 2: 1 do carimbo Loja + 1 de Missões (fronteira — US2 cenário 2/3).
    pedidos.registrar(&pedido(1, "2026-07-05", "111", 2, 5000)).await.unwrap();
    assert_eq!(estoque_de(&db, "111").await, 78);
    assert_eq!(carimbo_qtd(&db, "111", loja).await, 0);
    assert_eq!(carimbo_qtd(&db, "111", missoes).await, 69);

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
    assert_eq!(r.posicao_atual.iter().find(|p| p.destinacao_id == missoes).unwrap().qtd, 69);

    // Repasse do fechamento: só destinações especiais (a Loja não é repasse).
    let rep = repo.repasse("2026-07-05", "dia").await.unwrap();
    assert_eq!(rep.len(), 1);
    assert_eq!((rep[0].nome.as_str(), rep[0].qtd, rep[0].valor_centavos), ("Missões", 1, 5000));
    assert_eq!(rep[0].livros[0].titulo, "A Cruz de Cristo");

    // Estorno (mesmo dia): devolve ao carimbo certo, inclusive Loja (FR-010/SC-004).
    cancelamento::cancelar_venda(1, &pedidos, &RelogioFixo).await.unwrap();
    assert_eq!(estoque_de(&db, "111").await, 80);
    assert_eq!(carimbo_qtd(&db, "111", loja).await, 1);
    assert_eq!(carimbo_qtd(&db, "111", missoes).await, 70);
    // Retroativo no relatório + idempotente (2º cancelamento não duplica).
    cancelamento::cancelar_venda(1, &pedidos, &RelogioFixo).await.unwrap();
    let r = dest::relatorio("2026-07-05", "2026-07-05", &repo).await.unwrap();
    assert_eq!(r.total_centavos, 0);
    assert_eq!(carimbo_qtd(&db, "111", loja).await, 1);

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
async fn perdas_protegem_carimbos_ajuste() {
    let (db, path) = setup("perdas").await;
    let estoque = SeaEstoqueRepo::new(db.clone());
    let missoes = criar_dest(&db, "Missões").await;

    // Ajuste negativo: livre 5 + Missões 10 → perda de 3 não toca Missões (FR-012).
    semear_livro(&db, "444", 15, 2000).await;
    carimbo(&db, "444", missoes, 10).await;
    estoque.registrar_ajuste("444", -3, "quebra").await.unwrap();
    assert_eq!(
        (estoque_de(&db, "444").await, livre(&db, "444").await, carimbo_qtd(&db, "444", missoes).await),
        (12, 2, 10)
    );
    // Perda além do livre avança pelos carimbos.
    estoque.registrar_ajuste("444", -11, "quebra maior").await.unwrap();
    assert_eq!(
        (estoque_de(&db, "444").await, livre(&db, "444").await, carimbo_qtd(&db, "444", missoes).await),
        (1, 0, 1)
    );
    // Ajuste positivo entra como livre.
    estoque.registrar_ajuste("444", 4, "achado").await.unwrap();
    assert_eq!((livre(&db, "444").await, carimbo_qtd(&db, "444", missoes).await), (4, 1));

    // (Feature 012: o estorno de nota de entrada saiu do PDV — lançamento vive na
    // nuvem. A proteção de carimbos por perda/ajuste segue coberta acima.)

    let _ = std::fs::remove_file(&path);
}
