//! Teste de integração do inventário (US2, T032): fechamento parcial ajusta só os
//! contados (SC-004) e é idempotente; modo total zera os não bipados; pendências.

use livraria_2_lib::adapters::persistencia::inventario_repo::SeaInventarioRepo;
use livraria_2_lib::adapters::persistencia::estoque_repo::SeaEstoqueRepo;
use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::ports::LivroRepo;
use livraria_2_lib::application::ports_estoque::EstoqueRepo;
use livraria_2_lib::application::ports_inventario::InventarioRepo;
use livraria_2_lib::domain::categoria::Categoria;
use livraria_2_lib::domain::dinheiro::Dinheiro;
use livraria_2_lib::domain::livro::Livro;

fn url_temp(tag: &str) -> (String, std::path::PathBuf) {
    let path = std::env::temp_dir()
        .join(format!("livraria_inv_{}_{tag}.db", std::process::id()));
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

async fn estoque_de(livros: &SeaLivroRepo, codigo: &str) -> i64 {
    livros.por_codigo(codigo).await.unwrap().unwrap().estoque
}

#[tokio::test]
async fn parcial_idempotente_e_total_zera() {
    let (url, path) = url_temp("parcial");
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let livros = SeaLivroRepo::new(db.clone());
    let estoque = SeaEstoqueRepo::new(db.clone());
    let inv = SeaInventarioRepo::new(db.clone());

    livros.salvar(&livro("A", 5)).await.unwrap();
    livros.salvar(&livro("B", 3)).await.unwrap();
    estoque.gerar_saldos_iniciais().await.unwrap();

    // --- Sessão PARCIAL "Gaveta A": conta só A (bipa 4x). ---
    let s = inv.abrir("parcial", Some("Gaveta A".into())).await.unwrap();
    for _ in 0..4 {
        inv.bipar(s.id, "A").await.unwrap();
    }
    let rev = inv.revisao(s.id).await.unwrap();
    assert_eq!(rev.len(), 1);
    assert_eq!(rev[0].diferenca, -1); // sistema 5, contado 4

    let fech = inv.fechar(s.id, false).await.unwrap();
    assert_eq!(fech.ajustados.len(), 1);
    assert_eq!(estoque_de(&livros, "A").await, 4); // ajustado para o contado
    assert_eq!(estoque_de(&livros, "B").await, 3); // SC-004: intacto

    // Idempotente (FR-030): fechar de novo não reaplica.
    let fech2 = inv.fechar(s.id, false).await.unwrap();
    assert_eq!(fech2.ajustados.len(), 1);
    assert_eq!(estoque_de(&livros, "A").await, 4);

    // Divergências recuperáveis pós-fechamento (FR-029).
    assert_eq!(inv.divergencias(s.id).await.unwrap()[0].diferenca, -1);

    // US3: a sessão aparece nos realizados e o relatório traz os agregados.
    let realizadas = inv.sessoes_realizadas().await.unwrap();
    assert!(realizadas.iter().any(|x| x.id == s.id && x.status == "fechada"));
    let rel = inv.relatorio_sessao(s.id).await.unwrap();
    assert_eq!(rel.resumo.total, 1); // só A foi contado
    assert_eq!(rel.resumo.faltaram, 1); // A: sistema 5, contado 4
    assert_eq!(rel.resumo.sobraram, 0);
    assert_eq!(rel.itens.len(), 1);

    // --- Código desconhecido vira pendência (US5). ---
    let s2 = inv.abrir("parcial", None).await.unwrap();
    let r = inv.bipar(s2.id, "999-INEXISTENTE").await.unwrap();
    assert!(r.livro.is_none() && r.pendencia.is_some());
    assert_eq!(inv.pendencias(true).await.unwrap().len(), 1);
    inv.cancelar(s2.id).await.unwrap();

    // --- Sessão TOTAL: conta só A (1x); B não bipado deve zerar. ---
    let s3 = inv.abrir("total", None).await.unwrap();
    inv.bipar(s3.id, "A").await.unwrap(); // A contado 1 (sistema 4)
    assert!(inv.fechar(s3.id, false).await.is_err()); // exige confirmação
    inv.fechar(s3.id, true).await.unwrap();
    assert_eq!(estoque_de(&livros, "A").await, 1);
    assert_eq!(estoque_de(&livros, "B").await, 0); // não bipado → zerado

    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn desbipar_decrementa_e_remove_ao_zerar() {
    let (url, path) = url_temp("desbipar");
    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let livros = SeaLivroRepo::new(db.clone());
    let estoque = SeaEstoqueRepo::new(db.clone());
    let inv = SeaInventarioRepo::new(db.clone());

    livros.salvar(&livro("A", 5)).await.unwrap();
    estoque.gerar_saldos_iniciais().await.unwrap();

    let s = inv.abrir("parcial", Some("Gaveta A".into())).await.unwrap();
    inv.bipar(s.id, "A").await.unwrap();
    let r = inv.bipar(s.id, "A").await.unwrap();
    assert_eq!(r.qtd_contada, Some(2));

    // desbipar volta para 1
    let r = inv.desbipar(s.id, "A").await.unwrap();
    assert_eq!(r.qtd_contada, Some(1));

    // desbipar de novo zera → some da contagem (revisao não lista o livro)
    let r = inv.desbipar(s.id, "A").await.unwrap();
    assert_eq!(r.qtd_contada, Some(0));
    assert!(inv.revisao(s.id).await.unwrap().is_empty());

    // fechar parcial sem itens contados não altera o estoque (SC-004).
    inv.fechar(s.id, false).await.unwrap();
    assert_eq!(livros.por_codigo("A").await.unwrap().unwrap().estoque, 5);

    let _ = std::fs::remove_file(&path);
}
