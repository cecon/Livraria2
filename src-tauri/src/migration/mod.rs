//! Migrations idempotentes aplicadas por comando (ADR-0004, FR-061).
//! Estratégia KISS: o migrator (rastreado em `seaql_migrations`) executa DDL
//! `CREATE TABLE IF NOT EXISTS`, de modo que re-aplicar em base nova ou já
//! existente converge sem erro nem perda de dados.

use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![Box::new(m_init::Migration)]
    }
}

mod m_init {
    use sea_orm_migration::prelude::*;
    use sea_orm_migration::sea_orm::{ConnectionTrait, Statement};

    #[derive(DeriveMigrationName)]
    pub struct Migration;

    const UP: &[&str] = &[
        "CREATE TABLE IF NOT EXISTS livro (
            codigo TEXT PRIMARY KEY,
            titulo TEXT NOT NULL,
            autor TEXT,
            preco_centavos INTEGER NOT NULL DEFAULT 0,
            categoria INTEGER NOT NULL DEFAULT 0,
            estoque INTEGER NOT NULL DEFAULT 0,
            descricao TEXT,
            busca_norm TEXT NOT NULL DEFAULT '',
            ativo INTEGER NOT NULL DEFAULT 1
        )",
        "CREATE INDEX IF NOT EXISTS idx_livro_busca ON livro(busca_norm)",
        "CREATE TABLE IF NOT EXISTS pedido (
            numero INTEGER PRIMARY KEY,
            cliente TEXT NOT NULL DEFAULT 'CLIENTE',
            turno TEXT NOT NULL,
            data TEXT NOT NULL,
            total_centavos INTEGER NOT NULL,
            val_cartao INTEGER NOT NULL DEFAULT 0,
            val_dinheiro INTEGER NOT NULL DEFAULT 0,
            val_pix INTEGER NOT NULL DEFAULT 0,
            val_ministerio INTEGER NOT NULL DEFAULT 0,
            val_vale INTEGER NOT NULL DEFAULT 0
        )",
        "CREATE TABLE IF NOT EXISTS item_pedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_numero INTEGER NOT NULL REFERENCES pedido(numero),
            codigo TEXT NOT NULL REFERENCES livro(codigo),
            titulo TEXT NOT NULL,
            preco_centavos INTEGER NOT NULL,
            qtd INTEGER NOT NULL
        )",
        "CREATE INDEX IF NOT EXISTS idx_item_pedido ON item_pedido(pedido_numero)",
        "CREATE TABLE IF NOT EXISTS usuario (
            usuario TEXT PRIMARY KEY,
            senha_hash TEXT NOT NULL,
            nome TEXT
        )",
    ];

    const DOWN: &[&str] = &[
        "DROP TABLE IF EXISTS item_pedido",
        "DROP TABLE IF EXISTS pedido",
        "DROP TABLE IF EXISTS usuario",
        "DROP TABLE IF EXISTS livro",
    ];

    async fn executar(manager: &SchemaManager<'_>, stmts: &[&str]) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let backend = db.get_database_backend();
        for sql in stmts {
            db.execute(Statement::from_string(backend, String::from(*sql)))
                .await?;
        }
        Ok(())
    }

    #[async_trait::async_trait]
    impl MigrationTrait for Migration {
        async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
            executar(manager, UP).await
        }

        async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
            executar(manager, DOWN).await
        }
    }
}
