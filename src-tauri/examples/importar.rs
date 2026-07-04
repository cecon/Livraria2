//! Utilitário de importação do legado para o banco do app (uso local do mantenedor).
//! Uso: cargo run --example importar -- <caminho.mdb> [url-sqlite]
//! Sem o 2º arg, usa o banco do app (app_data_dir do Tauri).

use livraria_2_lib::adapters::legado::mdb_importer::MdbImportador;
use livraria_2_lib::adapters::persistencia::forma_pagamento_repo::SeaFormaPagamentoRepo;
use livraria_2_lib::adapters::persistencia::livro_repo::SeaLivroRepo;
use livraria_2_lib::adapters::persistencia::pedido_repo::SeaPedidoRepo;
use livraria_2_lib::adapters::persistencia::usuario_repo::SeaUsuarioRepo;
use livraria_2_lib::adapters::persistencia::{conectar, inicializar_schema};
use livraria_2_lib::application::migracao::migrar;
use livraria_2_lib::application::ports::UsuarioRepo;

fn url_padrao_do_app() -> String {
    // macOS: ~/Library/Application Support/<identifier>/livraria.db
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    let dir = format!("{home}/Library/Application Support/com.espacodolivro.estoque");
    std::fs::create_dir_all(&dir).ok();
    format!("sqlite://{dir}/livraria.db?mode=rwc")
}

#[tokio::main]
async fn main() {
    let mdb = std::env::args()
        .nth(1)
        .expect("informe o caminho do .mdb");
    let url = std::env::args().nth(2).unwrap_or_else(url_padrao_do_app);

    println!("Legado: {mdb}");
    println!("Banco:  {url}");

    let db = conectar(&url).await.expect("conectar");
    inicializar_schema(&db).await.expect("schema");
    SeaUsuarioRepo::new(db.clone())
        .garantir_admin()
        .await
        .expect("admin");

    let imp = MdbImportador::new(mdb);
    let livros = SeaLivroRepo::new(db.clone());
    let pedidos = SeaPedidoRepo::new(db.clone());
    let formas = SeaFormaPagamentoRepo::new(db.clone());
    let r = migrar(&imp, &livros, &pedidos, &formas).await.expect("migrar");

    println!("---");
    println!("Livros importados:     {}", r.livros_importados);
    println!("Pedidos inseridos:     {}", r.pedidos_inseridos);
    println!("Pedidos já existentes: {}", r.pedidos_existentes);
    println!("Divergências:          {}", r.divergencias.len());
}
