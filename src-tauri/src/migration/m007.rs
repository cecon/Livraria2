//! m007 — Feature 006: destinação de estoque para doações (ADR-0014).
//! Só tabelas novas e seed da "Loja" — sem ALTERs, sem backfill (livre = resíduo
//! da Loja). Aplicada pelo migrator padrão; idempotente por IF NOT EXISTS.

use sea_orm_migration::prelude::*;
use sea_orm_migration::sea_orm::{ConnectionTrait, Statement};

pub struct Migration;
impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m007_destinacoes"
    }
}

pub const UP: &[&str] = &[
    "CREATE TABLE IF NOT EXISTS destinacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        nome_norm TEXT NOT NULL,
        de_sistema INTEGER NOT NULL DEFAULT 0,
        ativa INTEGER NOT NULL DEFAULT 1,
        ordem INTEGER NOT NULL DEFAULT 0
    )",
    "CREATE TABLE IF NOT EXISTS destinacao_saldo (
        livro_id INTEGER NOT NULL REFERENCES livro(id),
        destinacao_id INTEGER NOT NULL REFERENCES destinacao(id),
        qtd INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (livro_id, destinacao_id)
    )",
    "CREATE TABLE IF NOT EXISTS transferencia_destinacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        livro_id INTEGER NOT NULL REFERENCES livro(id),
        de_destinacao_id INTEGER REFERENCES destinacao(id),
        para_destinacao_id INTEGER REFERENCES destinacao(id),
        qtd INTEGER NOT NULL,
        motivo TEXT,
        criado_em TEXT NOT NULL DEFAULT ''
    )",
    "CREATE INDEX IF NOT EXISTS idx_transf_livro ON transferencia_destinacao(livro_id, id)",
    "CREATE TABLE IF NOT EXISTS alocacao_venda (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedido_numero INTEGER NOT NULL REFERENCES pedido(numero),
        item_id INTEGER NOT NULL REFERENCES item_pedido(id),
        destinacao_id INTEGER NOT NULL REFERENCES destinacao(id),
        qtd INTEGER NOT NULL,
        valor_centavos INTEGER NOT NULL
    )",
    "CREATE INDEX IF NOT EXISTS idx_aloc_pedido ON alocacao_venda(pedido_numero)",
    // Seed da destinação de sistema (padrão). Nome renomeável; a identidade é de_sistema=1.
    "INSERT INTO destinacao (nome, nome_norm, de_sistema, ativa, ordem)
     SELECT 'Loja', 'loja', 1, 1, 0
     WHERE NOT EXISTS (SELECT 1 FROM destinacao WHERE de_sistema = 1)",
];

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let backend = db.get_database_backend();
        for sql in UP {
            db.execute(Statement::from_string(backend, String::from(*sql)))
                .await?;
        }
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let backend = db.get_database_backend();
        for sql in [
            "DROP TABLE IF EXISTS alocacao_venda",
            "DROP TABLE IF EXISTS transferencia_destinacao",
            "DROP TABLE IF EXISTS destinacao_saldo",
            "DROP TABLE IF EXISTS destinacao",
        ] {
            db.execute(Statement::from_string(backend, String::from(sql)))
                .await?;
        }
        Ok(())
    }
}
