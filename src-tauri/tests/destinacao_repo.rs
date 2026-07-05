//! Testes de integração das destinações (US1/US3): cadastro com guards (Loja,
//! nome normalizado, em uso) e transferência de carimbos (saldos, histórico,
//! invariante Σ carimbos ≤ estoque, físico intocado) — ADR-0014.

use livraria_2_lib::adapters::persistencia::destinacao_repo::SeaDestinacaoRepo;
use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::destinacoes as uc;
use livraria_2_lib::application::erros::ErroApp;
use livraria_2_lib::application::ports::LivroRepo;
use livraria_2_lib::application::ports_destinacao::DestinacaoRepo;
use livraria_2_lib::domain::categoria::Categoria;
use livraria_2_lib::domain::dinheiro::Dinheiro;
use livraria_2_lib::domain::livro::Livro;
use sea_orm::DatabaseConnection;

fn url_temp(tag: &str) -> (String, std::path::PathBuf) {
    let path =
        std::env::temp_dir().join(format!("livraria_dest_{}_{tag}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

async fn setup(tag: &str) -> (DatabaseConnection, SeaDestinacaoRepo, std::path::PathBuf) {
    let (url, path) = url_temp(tag);
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap(); // m007 semeia a Loja
    (db.clone(), SeaDestinacaoRepo::new(db), path)
}

async fn semear_livro(db: &DatabaseConnection, codigo: &str, estoque: i64) {
    let livros = SeaLivroRepo::new(db.clone());
    livros
        .salvar(&Livro {
            codigo: codigo.into(),
            titulo: "A Cruz de Cristo".into(),
            autor: None,
            preco: Dinheiro::de_centavos(5000),
            categoria: Categoria::Biblias,
            estoque,
            descricao: None,
            custo_medio: Dinheiro::ZERO,
        })
        .await
        .unwrap();
}

fn codigo_de<T: std::fmt::Debug>(r: Result<T, ErroApp>) -> String {
    match r {
        Err(ErroApp::Dominio(e)) => e.codigo().to_string(),
        outro => panic!("esperava erro de domínio, veio: {outro:?}"),
    }
}

#[tokio::test]
async fn cadastro_seed_e_guards() {
    let (_db, repo, path) = setup("cadastro").await;

    // Seed: só a Loja, de sistema, ordem 0.
    let todas = uc::listar(&repo).await.unwrap();
    assert_eq!(todas.len(), 1);
    assert_eq!(todas[0].nome, "Loja");
    assert!(todas[0].de_sistema);

    // Criar Missões/Espaço; duplicado normalizado bloqueia (FR-003).
    let missoes = uc::criar("Missões", &repo).await.unwrap();
    let espaco = uc::criar("Espaço", &repo).await.unwrap();
    assert_eq!(codigo_de(uc::criar(" missoes ", &repo).await), "DESTINACAO_NOME_DUPLICADO");

    // Loja protegida: não desativa, não exclui, não reordena (FR-002).
    let loja_id = todas[0].id;
    assert_eq!(
        codigo_de(uc::definir_ativa(loja_id, false, &repo).await),
        "DESTINACAO_DE_SISTEMA"
    );
    assert_eq!(codigo_de(uc::excluir(loja_id, &repo).await), "DESTINACAO_DE_SISTEMA");
    assert_eq!(
        codigo_de(uc::reordenar(&[loja_id], &repo).await),
        "DESTINACAO_DE_SISTEMA"
    );

    // Reordenar livres: Espaço antes de Missões (FR-001) — Loja segue primeira.
    let ordenadas = uc::reordenar(&[espaco.id, missoes.id], &repo).await.unwrap();
    let nomes: Vec<_> = ordenadas.iter().map(|d| d.nome.as_str()).collect();
    assert_eq!(nomes, vec!["Loja", "Espaço", "Missões"]);

    // Renomear a Loja é permitido (FR-002).
    let loja = uc::renomear(loja_id, "Livraria", &repo).await.unwrap();
    assert_eq!(loja.nome, "Livraria");

    // Excluir nunca usada é permitido (FR-004).
    uc::excluir(espaco.id, &repo).await.unwrap();
    assert_eq!(uc::listar(&repo).await.unwrap().len(), 2);

    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn transferencia_saldos_historico_e_guards() {
    let (db, repo, path) = setup("transf").await;
    semear_livro(&db, "111", 80).await;
    let livro = "111";
    let missoes = uc::criar("Missões", &repo).await.unwrap();
    let espaco = uc::criar("Espaço", &repo).await.unwrap();

    // Livre → Missões 50: físico intocado, livre 30, Missões 50 (US1).
    let s = uc::transferir(livro, None, Some(missoes.id), 50, Some("doação".into()), &repo)
        .await
        .unwrap();
    assert_eq!((s.estoque, s.livre), (80, 30));
    assert_eq!(s.carimbos[0].qtd, 50);

    // Missões → Livre 10 (correção) e Missões → Espaço 5.
    let s = uc::transferir(livro, Some(missoes.id), None, 10, None, &repo).await.unwrap();
    assert_eq!((s.livre, s.carimbos[0].qtd), (40, 40));
    let s = uc::transferir(livro, Some(missoes.id), Some(espaco.id), 5, None, &repo)
        .await
        .unwrap();
    let total_carimbado: i64 = s.carimbos.iter().map(|c| c.qtd).sum();
    assert!(total_carimbado <= s.estoque, "Σ carimbos ≤ físico");
    assert_eq!(s.livre + total_carimbado, s.estoque);

    // Guards: saldo insuficiente (com disponível na mensagem), de == para, destino inativo.
    let e = uc::transferir(livro, None, Some(missoes.id), 100, None, &repo).await;
    match e {
        Err(ErroApp::Dominio(d)) => {
            assert_eq!(d.codigo(), "SALDO_INSUFICIENTE");
            assert!(d.to_string().contains("40"), "mensagem traz o disponível");
        }
        outro => panic!("esperava SALDO_INSUFICIENTE, veio {outro:?}"),
    }
    assert_eq!(
        codigo_de(uc::transferir(livro, None, None, 1, None, &repo).await),
        "TRANSFERENCIA_INVALIDA"
    );
    uc::definir_ativa(espaco.id, false, &repo).await.unwrap();
    assert_eq!(
        codigo_de(uc::transferir(livro, None, Some(espaco.id), 1, None, &repo).await),
        "DESTINACAO_INATIVA"
    );
    // Origem inativa pode drenar (FR-005).
    let s = uc::transferir(livro, Some(espaco.id), None, 5, None, &repo).await.unwrap();
    assert!(s.carimbos.iter().all(|c| c.destinacao_id != espaco.id));

    // Histórico registra tudo, mais recente primeiro (FR-007).
    let hist = uc::historico(livro, &repo).await.unwrap();
    assert_eq!(hist.len(), 4);
    assert_eq!(hist.last().unwrap().motivo.as_deref(), Some("doação"));
    assert_eq!(hist.last().unwrap().de, None); // livre
    assert_eq!(hist.last().unwrap().para.as_deref(), Some("Missões"));

    // Em uso: Missões (saldo + transferências) não pode ser excluída (FR-004).
    assert_eq!(codigo_de(uc::excluir(missoes.id, &repo).await), "DESTINACAO_EM_USO");
    assert!(repo.em_uso(missoes.id).await.unwrap());

    let _ = std::fs::remove_file(&path);
}
