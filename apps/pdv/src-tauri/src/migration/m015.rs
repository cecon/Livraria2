//! Livro-caixa local do turno. A migracao preserva o historico existente.

use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    for sql in [
        "CREATE TABLE IF NOT EXISTS caixa_movimento (
            sync_uid TEXT PRIMARY KEY,
            turno_uid TEXT NOT NULL REFERENCES turno_operacao(sync_uid),
            operador TEXT NOT NULL,
            tipo TEXT NOT NULL CHECK (tipo IN ('sangria', 'suprimento')),
            valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
            motivo TEXT NOT NULL CHECK (length(trim(motivo)) > 0),
            criado_em TEXT NOT NULL
        )",
        "CREATE INDEX IF NOT EXISTS idx_caixa_movimento_turno ON caixa_movimento(turno_uid, criado_em)",
    ] {
        db.execute(Statement::from_string(backend, sql.to_string())).await?;
    }
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use sea_orm::Database;

    #[tokio::test]
    async fn cria_tabela_idempotente_e_valida_valores() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        crate::adapters::persistencia::inicializar_schema(&db).await.unwrap();
        aplicar(&db).await.unwrap();
        let backend = db.get_database_backend();
        let result = db.execute(Statement::from_string(backend,
            "INSERT INTO caixa_movimento(sync_uid,turno_uid,operador,tipo,valor_centavos,motivo,criado_em)
             VALUES('1','turno','op','sangria',0,'teste','2026-01-01')".to_string())).await;
        assert!(result.is_err());
    }
}
