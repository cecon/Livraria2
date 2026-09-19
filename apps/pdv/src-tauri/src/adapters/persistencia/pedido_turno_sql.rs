use sea_orm::{ConnectionTrait, DatabaseTransaction, DbErr, Statement};

pub async fn vincular(tx: &DatabaseTransaction, numero: i64, turno_uid: &str, pdv_uid: &str) -> Result<(), DbErr> {
    let backend = tx.get_database_backend();
    let aberto = tx.query_one(Statement::from_sql_and_values(backend,
        "SELECT 1 AS ok FROM turno_operacao
         WHERE sync_uid=? AND pdv_uid=? AND status='aberto' AND excluido_em IS NULL",
        [turno_uid.into(), pdv_uid.into()])).await?;
    if aberto.is_none() {
        return Err(DbErr::Custom("turno aberto desta maquina nao encontrado".into()));
    }
    let row = tx.query_one(Statement::from_sql_and_values(backend,
        "SELECT COALESCE(MAX(numero_no_turno),0)+1 AS proximo FROM pedido WHERE turno_uid=?",
        [turno_uid.into()])).await?;
    let proximo: i64 = row.ok_or_else(|| DbErr::Custom("numero do turno indisponivel".into()))?
        .try_get("", "proximo")?;
    let result = tx.execute(Statement::from_sql_and_values(backend,
        "UPDATE pedido SET turno_uid=?, numero_no_turno=? WHERE numero=? AND turno_uid IS NULL",
        [turno_uid.into(), proximo.into(), numero.into()])).await?;
    if result.rows_affected() != 1 {
        return Err(DbErr::Custom("venda ja vinculada a outro turno".into()));
    }
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use sea_orm::{Database, TransactionTrait};

    #[tokio::test]
    async fn venda_recebe_turno_e_numero_na_mesma_transacao() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        crate::adapters::persistencia::inicializar_schema(&db).await.unwrap();
        let backend = db.get_database_backend();
        for sql in [
            "INSERT INTO maquina_pdv(uid,nome) VALUES('m1','Caixa 1')",
            "INSERT INTO turno_operacao(sync_uid,operador,abertura,pdv_uid) VALUES('t1','op','hoje','m1')",
            "INSERT INTO pedido(numero,turno,data,total_centavos) VALUES(1,'manha','hoje',0)",
            "INSERT INTO pedido(numero,turno,data,total_centavos) VALUES(2,'manha','hoje',0)",
        ] {
            db.execute(Statement::from_string(backend, sql.to_string())).await.unwrap();
        }
        let tx = db.begin().await.unwrap();
        vincular(&tx, 1, "t1", "m1").await.unwrap();
        vincular(&tx, 2, "t1", "m1").await.unwrap();
        tx.commit().await.unwrap();
        let rows = db.query_all(Statement::from_string(backend,
            "SELECT turno_uid,numero_no_turno FROM pedido ORDER BY numero".to_string())).await.unwrap();
        assert_eq!(rows[0].try_get::<String>("", "turno_uid").unwrap(), "t1");
        assert_eq!(rows[0].try_get::<i64>("", "numero_no_turno").unwrap(), 1);
        assert_eq!(rows[1].try_get::<i64>("", "numero_no_turno").unwrap(), 2);
        let tx = db.begin().await.unwrap();
        assert!(vincular(&tx, 2, "t1", "outra-maquina").await.is_err());
    }
}
