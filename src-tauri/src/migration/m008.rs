//! m008 — Feature 007: colunas de sincronização com a nuvem (ADR-0015/0016).
//!
//! Aditivo e idempotente, aplicado **após** m004/m006 (contra o schema final,
//! já com `livro.id`/`livro.codigo` e `forma_pagamento`): ADD COLUMN das colunas
//! de sync (ignora "duplicate column"), backfill de `sync_uid` (UUID v4 gerado em
//! SQL puro), `pedido.operador`, índices únicos de `sync_uid` e a tabela local
//! `sync_cursor`. `usuario.senha_hash` NUNCA é tocado — fica fora do sync (D15).

use sea_orm_migration::sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

/// Tabelas sincronizáveis (schema final, pós m004/m006).
pub const TABELAS_SYNC: &[&str] = &[
    "livro",
    "movimento_estoque",
    "pedido",
    "item_pedido",
    "pagamento_pedido",
    "forma_pagamento",
    "lancamento_entrada",
    "item_lancamento",
    "fornecedor",
    "destinacao",
    "transferencia_destinacao",
    "alocacao_venda",
    "usuario",
];

/// Colunas de sync adicionadas a cada tabela sincronizável.
/// `atualizado_em` já existe em `livro` (m_init) — o ADD é ignorado lá.
const COLUNAS_SYNC: &[&str] = &[
    "sync_uid TEXT",
    "origem TEXT NOT NULL DEFAULT 'pdv'",
    "atualizado_em TEXT NOT NULL DEFAULT ''",
    "excluido_em TEXT",
    "sincronizado_em TEXT",
];

/// UUID v4 gerado em SQL puro (independe de rng/relógio do Rust; distinto por linha).
const UUID_V4: &str = "lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'\
||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)\
||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))";

async fn exec(db: &DatabaseConnection, sql: String) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    db.execute(Statement::from_string(backend, sql)).await.map(|_| ())
}

/// ALTER ADD COLUMN idempotente: ignora o erro de coluna já existente
/// (SQLite não tem `ADD COLUMN IF NOT EXISTS`; mesmo padrão da m_estoque/m005).
async fn add_coluna(db: &DatabaseConnection, tabela: &str, coluna_def: &str) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    let sql = format!("ALTER TABLE {tabela} ADD COLUMN {coluna_def}");
    if let Err(e) = db.execute(Statement::from_string(backend, sql)).await {
        if !e.to_string().to_lowercase().contains("duplicate column") {
            return Err(e);
        }
    }
    Ok(())
}

/// Aplica a m008. Idempotente: re-executar não duplica coluna, índice, linha
/// nem `sync_uid` (backfill só cobre linhas sem uid).
pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    for tabela in TABELAS_SYNC {
        for coluna in COLUNAS_SYNC {
            add_coluna(db, tabela, coluna).await?;
        }
        exec(
            db,
            format!("UPDATE {tabela} SET sync_uid = ({UUID_V4}) WHERE sync_uid IS NULL OR sync_uid = ''"),
        )
        .await?;
        exec(
            db,
            format!("CREATE UNIQUE INDEX IF NOT EXISTS idx_{tabela}_syncuid ON {tabela}(sync_uid)"),
        )
        .await?;
    }
    // Atribuição da venda ao operador (FR-023).
    add_coluna(db, "pedido", "operador TEXT").await?;
    // Cursor de pull da sincronização — estado local, não sincronizado (D10).
    exec(
        db,
        "CREATE TABLE IF NOT EXISTS sync_cursor (recurso TEXT PRIMARY KEY, last_cursor TEXT NOT NULL DEFAULT '')".to_string(),
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use sea_orm_migration::sea_orm::Database;

    async fn coluna_existe(db: &DatabaseConnection, tabela: &str, coluna: &str) -> bool {
        let backend = db.get_database_backend();
        let rows = db
            .query_all(Statement::from_string(
                backend,
                format!("SELECT 1 FROM pragma_table_info('{tabela}') WHERE name='{coluna}'"),
            ))
            .await
            .unwrap();
        !rows.is_empty()
    }

    async fn tabela_existe(db: &DatabaseConnection, t: &str) -> bool {
        let backend = db.get_database_backend();
        let rows = db
            .query_all(Statement::from_string(
                backend,
                format!("SELECT 1 FROM sqlite_master WHERE type='table' AND name='{t}'"),
            ))
            .await
            .unwrap();
        !rows.is_empty()
    }

    #[tokio::test]
    async fn m008_idempotente_e_backfill_de_sync_uid() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        // Boot completo (Migrator + m004 + m006 + m008): m008 roda uma vez aqui.
        crate::adapters::persistencia::inicializar_schema(&db).await.unwrap();

        // Insere operadores sem sync_uid para exercitar o backfill ao reaplicar.
        exec(
            &db,
            "INSERT INTO usuario (usuario, senha_hash, nome) VALUES ('a','h','A'),('b','h','B')"
                .to_string(),
        )
        .await
        .unwrap();

        // Reaplicar 2× não deve falhar (idempotência) e deve preencher os novos uids.
        aplicar(&db).await.unwrap();
        aplicar(&db).await.unwrap();

        // Colunas/tabela de sync presentes.
        assert!(coluna_existe(&db, "movimento_estoque", "sync_uid").await);
        assert!(coluna_existe(&db, "pedido", "operador").await);
        assert!(coluna_existe(&db, "usuario", "sincronizado_em").await);
        assert!(tabela_existe(&db, "sync_cursor").await);

        // sync_uid preenchido e DISTINTO para os dois operadores.
        let backend = db.get_database_backend();
        let rows = db
            .query_all(Statement::from_string(
                backend,
                "SELECT sync_uid FROM usuario WHERE usuario IN ('a','b')".to_string(),
            ))
            .await
            .unwrap();
        let uids: Vec<String> = rows
            .iter()
            .map(|r| r.try_get::<String>("", "sync_uid").unwrap())
            .collect();
        assert_eq!(uids.len(), 2);
        assert!(uids.iter().all(|u| u.len() == 36), "uid deve ter formato UUID");
        assert_ne!(uids[0], uids[1]);
    }
}
