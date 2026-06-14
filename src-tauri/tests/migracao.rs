//! Teste de integração da migração contra o legado REAL (FR-065..069, SC-009).
//! Pula automaticamente se o `.mdb` ou o `mdb-export` não estiverem disponíveis.

use livraria_2_lib::adapters::legado::mdb_importer::MdbImportador;
use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::migracao::migrar;
use std::path::Path;

fn mdb_disponivel(mdb: &str) -> bool {
    Path::new(mdb).exists()
        && std::process::Command::new("mdb-export")
            .arg("--help")
            .output()
            .is_ok()
}

#[tokio::test]
async fn migra_legado_real_idempotente() {
    let mdb = format!("{}/../../Livraria/livraria.mdb", env!("CARGO_MANIFEST_DIR"));
    if !mdb_disponivel(&mdb) {
        eprintln!("legado/mdb-export indisponível — teste pulado");
        return;
    }

    let path = std::env::temp_dir().join(format!("livraria_mig_real_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    let url = format!("sqlite://{}?mode=rwc", path.display());

    let db = conectar(&url).await.unwrap();
    inicializar_schema(&db).await.unwrap();
    let imp = MdbImportador::new(mdb);
    let livros = SeaLivroRepo::new(db.clone());
    let pedidos = SeaPedidoRepo::new(db.clone());

    let r1 = migrar(&imp, &livros, &pedidos).await.unwrap();
    eprintln!(
        "MIGRAÇÃO: {} livros, {} pedidos inseridos, {} divergências",
        r1.livros_importados,
        r1.pedidos_inseridos,
        r1.divergencias.len()
    );
    assert!(r1.livros_importados > 400, "livros: {}", r1.livros_importados);
    assert!(r1.pedidos_inseridos > 100, "pedidos: {}", r1.pedidos_inseridos);

    // As formas de pagamento NÃO podem vir todas como dinheiro: o legado grava
    // cartão/pix nas colunas de valor do resumo (regressão corrigida).
    use sea_orm::{ConnectionTrait, Statement};
    let backend = db.get_database_backend();
    let row = db
        .query_one(Statement::from_string(
            backend,
            "SELECT COALESCE(SUM(val_cartao),0) c, COALESCE(SUM(val_pix),0) p FROM pedido"
                .to_string(),
        ))
        .await
        .unwrap()
        .unwrap();
    let cartao: i64 = row.try_get("", "c").unwrap();
    let pix: i64 = row.try_get("", "p").unwrap();
    assert!(cartao > 0, "deve haver vendas no cartão");
    assert!(pix > 0, "deve haver vendas no PIX");

    // Idempotência (FR-069): re-rodar não insere pedidos novos.
    let r2 = migrar(&imp, &livros, &pedidos).await.unwrap();
    assert_eq!(r2.pedidos_inseridos, 0, "re-rodar não deve inserir pedidos");
    assert_eq!(r2.pedidos_existentes, r1.pedidos_inseridos);

    let _ = std::fs::remove_file(&path);
}
