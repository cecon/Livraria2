//! m014 (feature 013): colunas locais do "turno como unidade".
//!
//! - `turno_operacao.maquina`: nome do PC onde o turno foi aberto — compõe a
//!   identidade (FR-015), aparece no header (FR-021) e sobe no sync.
//! - `pedido.ja_sincronizado`: marcador LOCAL de "já subiu à nuvem alguma vez"
//!   (setado no 1º push confirmado, nunca limpo pelo cancelamento). Substitui o
//!   `estoque_status` puxado no cálculo do saldo operacional, já que a venda
//!   passa a ser push-only (FR-006, ADR-0025).
//!
//! Aditivo e idempotente: `ADD COLUMN` ignorando "duplicate column" (mesmo padrão
//! da m006/m008/m011); re-aplicar não duplica coluna nem perde dados.

use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

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

pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    add_coluna(db, "turno_operacao", "maquina TEXT").await?;
    add_coluna(db, "pedido", "ja_sincronizado INTEGER NOT NULL DEFAULT 0").await?;
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use sea_orm::Database;

    async fn coluna_existe(db: &DatabaseConnection, tabela: &str, coluna: &str) -> bool {
        let rows = db
            .query_all(Statement::from_string(
                db.get_database_backend(),
                format!("SELECT 1 FROM pragma_table_info('{tabela}') WHERE name='{coluna}'"),
            ))
            .await
            .unwrap();
        !rows.is_empty()
    }

    #[tokio::test]
    async fn adiciona_colunas_idempotente() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        crate::adapters::persistencia::inicializar_schema(&db).await.unwrap();
        // Re-aplicar 2× não deve falhar.
        aplicar(&db).await.unwrap();
        aplicar(&db).await.unwrap();
        assert!(coluna_existe(&db, "turno_operacao", "maquina").await);
        assert!(coluna_existe(&db, "pedido", "ja_sincronizado").await);
    }
}
