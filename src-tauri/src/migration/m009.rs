//! m009 — Feature 009: turno de operação (ADR-0021).
//!
//! Aditivo e idempotente, aplicado **após** m008 (contra o schema final, já com as
//! colunas de sync): cria a tabela `turno_operacao` (chaveada por `sync_uid`, com as
//! mesmas colunas de sync das demais réplicas locais) e adiciona
//! `pedido.turno_uid`/`pedido.numero_no_turno` (FK lógica por `sync_uid`). Pedidos
//! legados toleram `turno_uid` nulo; o turno só é exigido em **novas** vendas.

use sea_orm_migration::sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

async fn exec(db: &DatabaseConnection, sql: String) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    db.execute(Statement::from_string(backend, sql)).await.map(|_| ())
}

/// ALTER ADD COLUMN idempotente: ignora "duplicate column" (mesmo padrão da m008).
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

/// Aplica a m009. Idempotente: `CREATE TABLE/INDEX IF NOT EXISTS` e ADD COLUMN
/// tolerante a coluna já existente — re-executar não duplica nem quebra.
pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Tabela do turno de operação (réplica local, chaveada por sync_uid).
    exec(
        db,
        "CREATE TABLE IF NOT EXISTS turno_operacao (\
            sync_uid TEXT PRIMARY KEY,\
            operador TEXT,\
            caixa_inicial_centavos INTEGER NOT NULL DEFAULT 0,\
            status TEXT NOT NULL DEFAULT 'aberto',\
            abertura TEXT NOT NULL DEFAULT '',\
            encerramento TEXT,\
            esperado_centavos INTEGER,\
            conferido_centavos INTEGER,\
            diferenca_centavos INTEGER,\
            origem TEXT NOT NULL DEFAULT 'pdv',\
            atualizado_em TEXT NOT NULL DEFAULT '',\
            excluido_em TEXT,\
            sincronizado_em TEXT\
        )"
        .to_string(),
    )
    .await?;
    exec(
        db,
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_turno_operacao_syncuid ON turno_operacao(sync_uid)"
            .to_string(),
    )
    .await?;

    // Vínculo da venda ao turno + numeração por turno (FR-003).
    add_coluna(db, "pedido", "turno_uid TEXT").await?;
    add_coluna(db, "pedido", "numero_no_turno INTEGER").await?;
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
    async fn m009_cria_turno_e_colunas_idempotente() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        // Boot completo (inclui m009 uma vez).
        crate::adapters::persistencia::inicializar_schema(&db).await.unwrap();
        // Reaplicar 2× não deve falhar (idempotência).
        aplicar(&db).await.unwrap();
        aplicar(&db).await.unwrap();

        assert!(tabela_existe(&db, "turno_operacao").await);
        assert!(coluna_existe(&db, "turno_operacao", "caixa_inicial_centavos").await);
        assert!(coluna_existe(&db, "turno_operacao", "diferenca_centavos").await);
        assert!(coluna_existe(&db, "pedido", "turno_uid").await);
        assert!(coluna_existe(&db, "pedido", "numero_no_turno").await);
    }
}
