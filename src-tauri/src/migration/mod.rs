//! Migrations idempotentes aplicadas por comando (ADR-0004, FR-061).
//! Estratégia KISS: o migrator (rastreado em `seaql_migrations`) executa DDL
//! `CREATE TABLE IF NOT EXISTS`, de modo que re-aplicar em base nova ou já
//! existente converge sem erro nem perda de dados.

use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m_init::Migration),
            Box::new(m_estoque::Migration),
            Box::new(m_fornecedores::Migration),
        ]
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
            ativo INTEGER NOT NULL DEFAULT 1,
            atualizado_em TEXT NOT NULL DEFAULT ''
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
            codigo TEXT NOT NULL,
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

/// Feature 002: razão de movimentos, custo médio e inventário (ADR-0008/0009/0010).
mod m_estoque {
    use sea_orm_migration::prelude::*;
    use sea_orm_migration::sea_orm::{ConnectionTrait, Statement};

    pub struct Migration;

    // Nome explícito e distinto de `m_init` (evita colisão de versão em seaql_migrations).
    impl MigrationName for Migration {
        fn name(&self) -> &str {
            "m002_estoque_inventario"
        }
    }

    /// Colunas novas em `livro` — SQLite não tem `ADD COLUMN IF NOT EXISTS`, então
    /// ignoramos o erro de coluna duplicada para manter a idempotência (ADR-0004).
    const ALTERS: &[&str] = &[
        "ALTER TABLE livro ADD COLUMN codigo_barras TEXT",
        "ALTER TABLE livro ADD COLUMN custo_medio_centavos INTEGER NOT NULL DEFAULT 0",
    ];

    const UP: &[&str] = &[
        "CREATE INDEX IF NOT EXISTS idx_livro_codbarras ON livro(codigo_barras)",
        "CREATE TABLE IF NOT EXISTS movimento_estoque (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            livro_codigo TEXT NOT NULL REFERENCES livro(codigo),
            tipo TEXT NOT NULL,
            qtd INTEGER NOT NULL,
            custo_unit_centavos INTEGER,
            fornecedor TEXT,
            motivo TEXT,
            referencia TEXT,
            criado_em TEXT NOT NULL DEFAULT ''
        )",
        "CREATE INDEX IF NOT EXISTS idx_mov_livro ON movimento_estoque(livro_codigo, id)",
        "CREATE TABLE IF NOT EXISTS sessao_inventario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            modo TEXT NOT NULL,
            rotulo TEXT,
            status TEXT NOT NULL DEFAULT 'aberta',
            aberta_em TEXT NOT NULL DEFAULT '',
            fechada_em TEXT
        )",
        "CREATE TABLE IF NOT EXISTS item_contagem (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sessao_id INTEGER NOT NULL REFERENCES sessao_inventario(id),
            livro_codigo TEXT NOT NULL REFERENCES livro(codigo),
            qtd_contada INTEGER NOT NULL DEFAULT 0,
            qtd_sistema INTEGER,
            UNIQUE(sessao_id, livro_codigo)
        )",
        "CREATE TABLE IF NOT EXISTS pendencia_cadastro (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sessao_id INTEGER REFERENCES sessao_inventario(id),
            codigo_lido TEXT NOT NULL,
            qtd INTEGER NOT NULL DEFAULT 1,
            resolvida INTEGER NOT NULL DEFAULT 0,
            criado_em TEXT NOT NULL DEFAULT ''
        )",
    ];

    const DOWN: &[&str] = &[
        "DROP TABLE IF EXISTS pendencia_cadastro",
        "DROP TABLE IF EXISTS item_contagem",
        "DROP TABLE IF EXISTS sessao_inventario",
        "DROP TABLE IF EXISTS movimento_estoque",
    ];

    #[async_trait::async_trait]
    impl MigrationTrait for Migration {
        async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
            let db = manager.get_connection();
            let backend = db.get_database_backend();
            for sql in ALTERS {
                if let Err(e) = db
                    .execute(Statement::from_string(backend, String::from(*sql)))
                    .await
                {
                    if !e.to_string().to_lowercase().contains("duplicate column") {
                        return Err(e);
                    }
                }
            }
            for sql in UP {
                db.execute(Statement::from_string(backend, String::from(*sql)))
                    .await?;
            }
            Ok(())
        }

        async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
            let db = manager.get_connection();
            let backend = db.get_database_backend();
            for sql in DOWN {
                db.execute(Statement::from_string(backend, String::from(*sql)))
                    .await?;
            }
            Ok(())
        }
    }
}

/// Feature 003: fornecedores e lançamento de notas de entrada (ADR-0011).
mod m_fornecedores {
    use sea_orm_migration::prelude::*;
    use sea_orm_migration::sea_orm::{ConnectionTrait, Statement};

    pub struct Migration;

    impl MigrationName for Migration {
        fn name(&self) -> &str {
            "m003_fornecedores_lancamentos"
        }
    }

    const UP: &[&str] = &[
        "CREATE TABLE IF NOT EXISTS fornecedor (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            nome_norm TEXT NOT NULL,
            documento TEXT,
            telefone TEXT,
            email TEXT,
            observacoes TEXT,
            ativo INTEGER NOT NULL DEFAULT 1
        )",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_fornecedor_norm ON fornecedor(nome_norm)",
        "CREATE TABLE IF NOT EXISTS lancamento_entrada (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fornecedor_id INTEGER REFERENCES fornecedor(id),
            numero TEXT,
            data TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'rascunho',
            finalizada_em TEXT
        )",
        "CREATE TABLE IF NOT EXISTS item_lancamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lancamento_id INTEGER NOT NULL REFERENCES lancamento_entrada(id),
            livro_codigo TEXT NOT NULL REFERENCES livro(codigo),
            qtd INTEGER NOT NULL,
            custo_unit_centavos INTEGER NOT NULL DEFAULT 0,
            UNIQUE(lancamento_id, livro_codigo)
        )",
        "CREATE INDEX IF NOT EXISTS idx_item_lanc ON item_lancamento(lancamento_id)",
    ];

    const DOWN: &[&str] = &[
        "DROP TABLE IF EXISTS item_lancamento",
        "DROP TABLE IF EXISTS lancamento_entrada",
        "DROP TABLE IF EXISTS fornecedor",
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
            for sql in DOWN {
                db.execute(Statement::from_string(backend, String::from(*sql)))
                    .await?;
            }
            Ok(())
        }
    }
}
