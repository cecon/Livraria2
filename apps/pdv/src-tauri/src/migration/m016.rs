//! Identidade da maquina e vinculos turno -> maquina, venda -> turno.

use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    db.execute(Statement::from_string(backend,
        "CREATE TABLE IF NOT EXISTS maquina_pdv (
            uid TEXT PRIMARY KEY,
            nome TEXT NOT NULL CHECK (length(trim(nome)) > 0)
        )".to_string())).await?;
    let cols = db.query_all(Statement::from_string(backend,
        "PRAGMA table_info(turno_operacao)".to_string())).await?;
    if !cols.iter().any(|r| r.try_get::<String>("", "name").ok().as_deref() == Some("pdv_uid")) {
        db.execute(Statement::from_string(backend,
            "ALTER TABLE turno_operacao ADD COLUMN pdv_uid TEXT REFERENCES maquina_pdv(uid)".to_string())).await?;
    }
    for sql in [
        "CREATE INDEX IF NOT EXISTS idx_turno_pdv_uid ON turno_operacao(pdv_uid)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_turno_aberto_maquina ON turno_operacao(pdv_uid)
         WHERE pdv_uid IS NOT NULL AND status='aberto' AND excluido_em IS NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_pedido_numero_turno ON pedido(turno_uid, numero_no_turno)
         WHERE turno_uid IS NOT NULL AND numero_no_turno IS NOT NULL",
        "CREATE TRIGGER IF NOT EXISTS trg_turno_maquina_insert BEFORE INSERT ON turno_operacao
         WHEN NEW.pdv_uid IS NOT NULL AND NOT EXISTS
              (SELECT 1 FROM maquina_pdv WHERE uid=NEW.pdv_uid)
         BEGIN SELECT RAISE(ABORT, 'maquina do turno nao encontrada'); END",
        "CREATE TRIGGER IF NOT EXISTS trg_turno_maquina_update BEFORE UPDATE OF pdv_uid ON turno_operacao
         WHEN NEW.pdv_uid IS NOT NULL AND NOT EXISTS
              (SELECT 1 FROM maquina_pdv WHERE uid=NEW.pdv_uid)
         BEGIN SELECT RAISE(ABORT, 'maquina do turno nao encontrada'); END",
        "CREATE TRIGGER IF NOT EXISTS trg_pedido_turno_update BEFORE UPDATE OF turno_uid ON pedido
         WHEN NEW.turno_uid IS NOT NULL AND NOT EXISTS
              (SELECT 1 FROM turno_operacao WHERE sync_uid=NEW.turno_uid)
         BEGIN SELECT RAISE(ABORT, 'turno da venda nao encontrado'); END",
        "CREATE TRIGGER IF NOT EXISTS trg_pedido_turno_insert BEFORE INSERT ON pedido
         WHEN NEW.turno_uid IS NOT NULL AND NOT EXISTS
              (SELECT 1 FROM turno_operacao WHERE sync_uid=NEW.turno_uid)
         BEGIN SELECT RAISE(ABORT, 'turno da venda nao encontrado'); END",
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
    async fn preserva_legado_e_impede_referencias_invalidas() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        crate::adapters::persistencia::inicializar_schema(&db).await.unwrap();
        aplicar(&db).await.unwrap();
        let backend = db.get_database_backend();
        let invalid = db.execute(Statement::from_string(backend,
            "INSERT INTO turno_operacao(sync_uid,operador,status,abertura,pdv_uid)
             VALUES('t1','op','aberto','hoje','maquina-inexistente')".to_string())).await;
        assert!(invalid.is_err());
        db.execute(Statement::from_string(backend,
            "INSERT INTO maquina_pdv(uid,nome) VALUES('m1','Caixa 1')".to_string())).await.unwrap();
        db.execute(Statement::from_string(backend,
            "INSERT INTO turno_operacao(sync_uid,operador,status,abertura,pdv_uid)
             VALUES('t1','op','aberto','hoje','m1')".to_string())).await.unwrap();
        let duplicate = db.execute(Statement::from_string(backend,
            "INSERT INTO turno_operacao(sync_uid,operador,status,abertura,pdv_uid)
             VALUES('t2','op2','aberto','hoje','m1')".to_string())).await;
        assert!(duplicate.is_err());
    }
}
