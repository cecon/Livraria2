//! Testes de integração do cadastro de formas (US2): guards de sistema/em uso/
//! última ativa, rótulo duplicado normalizado e reativação conflitante (D9).

use livraria_2_lib::adapters::persistencia::forma_pagamento_repo::SeaFormaPagamentoRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::erros::ErroApp;
use livraria_2_lib::application::formas_pagamento as uc;
use livraria_2_lib::application::ports::FormaPagamentoRepo;
use livraria_2_lib::domain::erros::ErroDominio;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};

fn url_temp(tag: &str) -> (String, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("livraria_formas_{}_{tag}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

async fn setup(tag: &str) -> (DatabaseConnection, SeaFormaPagamentoRepo, std::path::PathBuf) {
    let (url, path) = url_temp(tag);
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap(); // m006 semeia as 7 formas
    let repo = SeaFormaPagamentoRepo::new(db.clone());
    (db, repo, path)
}

fn codigo_de(r: Result<impl Sized, ErroApp>) -> String {
    match r {
        Err(ErroApp::Dominio(e)) => e.codigo().to_string(),
        Err(outro) => panic!("esperava erro de domínio, veio: {outro}"),
        Ok(_) => panic!("esperava erro, veio Ok"),
    }
}

#[tokio::test]
async fn seed_e_crud_basico() {
    let (_db, repo, path) = setup("crud").await;

    let formas = uc::listar(&repo).await.unwrap();
    assert_eq!(formas.len(), 7);
    assert_eq!(formas[0].rotulo, "Crédito"); // ordem 0 (ex-Cartão, FR-003)

    // Criar forma livre → aparece nas ativas, no fim da ordem (FR-005).
    let boleto = uc::criar("Boleto", true, &repo).await.unwrap();
    assert_eq!(boleto.chave, "boleto");
    assert!(!boleto.de_sistema);
    let ativas = uc::listar_ativas(&repo).await.unwrap();
    assert_eq!(ativas.len(), 8);
    assert_eq!(ativas.last().unwrap().rotulo, "Boleto");

    // Renomear preserva identidade/chave (FR-006).
    let renomeada = uc::renomear(boleto.id, "Boleto Bancário", &repo).await.unwrap();
    assert_eq!(renomeada.chave, "boleto");
    assert_eq!(renomeada.rotulo, "Boleto Bancário");

    // Reordenar reflete na listagem (FR-008).
    let mut ids: Vec<i64> = uc::listar(&repo).await.unwrap().iter().map(|f| f.id).collect();
    ids.rotate_left(1);
    let novas = uc::reordenar(&ids, &repo).await.unwrap();
    assert_eq!(novas.first().unwrap().id, ids[0]);

    // Desativar forma livre some das ativas (FR-007); excluir nunca usada remove (FR-009).
    uc::definir_ativa(boleto.id, false, &repo).await.unwrap();
    assert_eq!(uc::listar_ativas(&repo).await.unwrap().len(), 7);
    uc::excluir(boleto.id, &repo).await.unwrap();
    assert_eq!(uc::listar(&repo).await.unwrap().len(), 7);

    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn guards_de_sistema_e_em_uso() {
    let (db, repo, path) = setup("guards").await;
    let dinheiro = repo.por_chave("dinheiro").await.unwrap().unwrap();
    let debito = repo.por_chave("debito").await.unwrap().unwrap();

    // Forma de sistema: nem excluir nem desativar (FR-001a).
    assert_eq!(codigo_de(uc::excluir(dinheiro.id, &repo).await), "FORMA_DE_SISTEMA");
    assert_eq!(
        codigo_de(uc::definir_ativa(dinheiro.id, false, &repo).await),
        "FORMA_DE_SISTEMA"
    );

    // Forma em uso: exclusão bloqueada por checagem SQL explícita (FR-009/FR-017).
    for sql in [
        "INSERT INTO pedido (numero,cliente,turno,data,total_centavos) VALUES (1,'C','manha','2026-07-01',500)".to_string(),
        format!(
            "INSERT INTO pagamento_pedido (pedido_numero, forma_id, valor_centavos) VALUES (1, {}, 500)",
            debito.id
        ),
    ] {
        db.execute(Statement::from_string(db.get_database_backend(), sql))
            .await
            .unwrap();
    }
    assert!(repo.em_uso(debito.id).await.unwrap());
    assert_eq!(codigo_de(uc::excluir(debito.id, &repo).await), "FORMA_EM_USO");
    // ...mas desativar é permitido (forma livre).
    uc::definir_ativa(debito.id, false, &repo).await.unwrap();

    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn nome_duplicado_normalizado_e_reativacao_conflitante() {
    let (_db, repo, path) = setup("nomes").await;

    // Duplicata normalizada: "credito" = "Crédito" = " CRÉDITO " (FR-010/D9).
    assert_eq!(codigo_de(uc::criar("credito", true, &repo).await), "FORMA_NOME_DUPLICADO");
    assert_eq!(codigo_de(uc::criar(" CRÉDITO ", true, &repo).await), "FORMA_NOME_DUPLICADO");
    assert_eq!(codigo_de(uc::criar("   ", true, &repo).await), "NOME_OBRIGATORIO");

    // Renomear para nome de outra ativa também bloqueia.
    let boleto = uc::criar("Boleto", true, &repo).await.unwrap();
    assert_eq!(
        codigo_de(uc::renomear(boleto.id, "débito", &repo).await),
        "FORMA_NOME_DUPLICADO"
    );

    // Reativação conflitante (FR-007): desativa "Boleto", cria outro "Boleto",
    // tentar reativar o antigo é bloqueado — renomeie antes; sem renome automático.
    uc::definir_ativa(boleto.id, false, &repo).await.unwrap();
    let boleto2 = uc::criar("boleto", true, &repo).await.unwrap();
    assert_ne!(boleto2.chave, boleto.chave, "chave permanece única");
    assert_eq!(
        codigo_de(uc::definir_ativa(boleto.id, true, &repo).await),
        "FORMA_NOME_DUPLICADO"
    );
    // Após renomear, a reativação passa.
    uc::renomear(boleto.id, "Boleto Antigo", &repo).await.unwrap();
    let reativada = uc::definir_ativa(boleto.id, true, &repo).await.unwrap();
    assert!(reativada.ativa);

    let _ = std::fs::remove_file(&path);
}
