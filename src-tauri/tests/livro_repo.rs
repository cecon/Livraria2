//! Teste de integração do LivroRepo (US2): upsert idempotente, soft-delete, busca.

use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports::LivroRepo;
use livraria_2_lib::domain::categoria::Categoria;
use livraria_2_lib::domain::dinheiro::Dinheiro;
use livraria_2_lib::domain::livro::Livro;

fn url_temp() -> (String, std::path::PathBuf) {
    let path = std::env::temp_dir().join(format!("livraria_livrorepo_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    (format!("sqlite://{}?mode=rwc", path.display()), path)
}

fn livro(codigo: &str, titulo: &str, estoque: i64) -> Livro {
    Livro {
        codigo: codigo.into(),
        titulo: titulo.into(),
        autor: Some("Autor".into()),
        preco: Dinheiro::de_centavos(3000),
        categoria: Categoria::Biblias,
        estoque,
        descricao: None,
        custo_medio: Dinheiro::ZERO,
    }
}

#[tokio::test]
async fn upsert_soft_delete_e_busca() {
    let (url, path) = url_temp();
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let repo = SeaLivroRepo::new(db.clone());

    // Insere.
    repo.salvar(&livro("111", "Bíblia NVI", 5)).await.unwrap();
    // Upsert: mesmo código, dados alterados — não duplica, atualiza os campos editáveis.
    repo.salvar(&livro("111", "Bíblia NVI Capa Dura", 8))
        .await
        .unwrap();
    let l = repo.por_codigo("111").await.unwrap().unwrap();
    assert_eq!(l.titulo, "Bíblia NVI Capa Dura");
    // Estoque é governado pela razão de movimentos (feature 002): editar o livro
    // NÃO sobrescreve o saldo — permanece o valor original (5), não o 8 enviado.
    assert_eq!(l.estoque, 5);

    // Busca sem acento encontra o título acentuado.
    let achados = repo.buscar_texto("biblia", 10).await.unwrap();
    assert_eq!(achados.len(), 1);

    // Soft-delete: some das consultas mas o registro é preservado.
    repo.inativar("111").await.unwrap();
    assert!(repo.por_codigo("111").await.unwrap().is_none());
    assert_eq!(repo.buscar_texto("biblia", 10).await.unwrap().len(), 0);

    let _ = std::fs::remove_file(&path);
}
