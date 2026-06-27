//! Teste de integração do FornecedorRepo (US1, T011): dedup por nome_norm,
//! soft-delete, semear idempotente a partir de movimento_estoque.fornecedor.

use livraria_2_lib::adapters::persistencia::fornecedor_repo::SeaFornecedorRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports_compras::FornecedorRepo;
use livraria_2_lib::domain::fornecedor::Fornecedor;
use sea_orm::{ConnectionTrait, Statement};

fn url_temp() -> (String, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("livraria_forn_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

fn forn(nome: &str) -> Fornecedor {
    Fornecedor {
        id: 0,
        nome: nome.into(),
        documento: None,
        telefone: None,
        email: None,
        observacoes: None,
        ativo: true,
    }
}

#[tokio::test]
async fn dedup_soft_delete_e_semear() {
    let (url, path) = url_temp();
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let repo = SeaFornecedorRepo::new(db.clone());

    // Insere e checa dedup por nome_norm ("editora x" == "EDITORA X").
    let f = repo.salvar(&forn("Editora X")).await.unwrap();
    assert_eq!(f.id, 1);
    assert!(repo.existe_nome("editora x", 0).await.unwrap());
    assert!(!repo.existe_nome("editora x", 1).await.unwrap()); // exceto ele mesmo

    // Soft-delete: some da listagem.
    repo.excluir(1).await.unwrap();
    assert!(repo.listar("").await.unwrap().is_empty());

    // Semear: cria movimentos com fornecedores distintos e semeia.
    db.execute(Statement::from_string(
        db.get_database_backend(),
        "INSERT INTO livro (codigo, titulo, preco_centavos, categoria, estoque, busca_norm, ativo, atualizado_em, custo_medio_centavos)
         VALUES ('x', 'X', 0, 0, 0, '', 1, '', 0)"
            .to_string(),
    ))
    .await
    .unwrap();
    for nome in ["Editora Vida", "Editora Vida", "EDITORA SBB"] {
        db.execute(Statement::from_sql_and_values(
            db.get_database_backend(),
            "INSERT INTO movimento_estoque (livro_id, tipo, qtd, fornecedor, criado_em)
             VALUES ((SELECT id FROM livro WHERE codigo = 'x'), 'entrada', 1, ?, '')",
            [nome.into()],
        ))
        .await
        .unwrap();
    }
    let criados = repo.semear().await.unwrap();
    assert_eq!(criados, 2); // "Editora Vida" e "EDITORA SBB" (distintos)
    // Idempotente: re-semear não cria de novo.
    assert_eq!(repo.semear().await.unwrap(), 0);
    assert_eq!(repo.listar("vida").await.unwrap().len(), 1);

    let _ = std::fs::remove_file(&path);
}
