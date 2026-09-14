//! Adapter SeaORM da porta `TurnoRepo` (feature 009, ADR-0021). Persiste em
//! `turno_operacao` (m009), que sincroniza com a nuvem por `sync_uid`.

use crate::application::ports::RepoErro;
use crate::application::ports_turno::{
    DadosFechamento, TurnoAbertoInfo, TurnoComPendencia, TurnoHistorico, TurnoPodavel, TurnoRepo,
};
use crate::domain::dinheiro::Dinheiro;
use crate::domain::pedido::Recebimento;
use async_trait::async_trait;
use chrono::Local;
use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

pub struct SeaTurnoRepo {
    db: DatabaseConnection,
}

impl SeaTurnoRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

fn agora() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

#[async_trait]
impl TurnoRepo for SeaTurnoRepo {
    /// Filtra por `maquina` (não por operador): turnos de OUTROS PDVs descem pela
    /// réplica e não podem ser confundidos com o desta máquina (FR-015/FR-017).
    /// Turno legado (`maquina IS NULL`, aberto antes da m014) não é adotado — fica
    /// para o escritório fechar (US6); aqui um turno novo nasce já identificado.
    async fn turno_aberto_na_maquina(&self, maquina: &str) -> Result<Option<TurnoAbertoInfo>, RepoErro> {
        let backend = self.db.get_database_backend();
        let row = self
            .db
            .query_one(Statement::from_sql_and_values(
                backend,
                "SELECT sync_uid, caixa_inicial_centavos, abertura, operador, maquina \
                 FROM turno_operacao \
                 WHERE maquina = ? AND status = 'aberto' AND excluido_em IS NULL \
                 ORDER BY abertura DESC LIMIT 1",
                [maquina.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(row.and_then(|r| {
            Some(TurnoAbertoInfo {
                sync_uid: r.try_get("", "sync_uid").ok()?,
                caixa_inicial_centavos: r.try_get("", "caixa_inicial_centavos").ok()?,
                abertura: r.try_get("", "abertura").ok()?,
                operador: r.try_get("", "operador").unwrap_or_default(),
                maquina: r.try_get("", "maquina").ok(),
            })
        }))
    }

    async fn abrir(
        &self,
        operador: &str,
        caixa_inicial_centavos: i64,
        maquina: &str,
    ) -> Result<TurnoAbertoInfo, RepoErro> {
        let backend = self.db.get_database_backend();
        // UUID v4 gerado em SQL (mesmo gerador da réplica — m008), lido de volta.
        let uid: String = self
            .db
            .query_one(Statement::from_string(
                backend,
                format!("SELECT ({}) AS uid", crate::migration::m008::UUID_V4),
            ))
            .await
            .map_err(erro)?
            .and_then(|r| r.try_get::<String>("", "uid").ok())
            .ok_or_else(|| RepoErro::Persistencia("falha ao gerar sync_uid".into()))?;
        let ts = agora();
        self.db
            .execute(Statement::from_sql_and_values(
                backend,
                "INSERT INTO turno_operacao \
                 (sync_uid, operador, caixa_inicial_centavos, status, abertura, maquina, origem, atualizado_em) \
                 VALUES (?, ?, ?, 'aberto', ?, ?, 'pdv', ?)",
                [
                    uid.clone().into(),
                    operador.into(),
                    caixa_inicial_centavos.into(),
                    ts.clone().into(),
                    maquina.into(),
                    ts.clone().into(),
                ],
            ))
            .await
            .map_err(erro)?;
        Ok(TurnoAbertoInfo {
            sync_uid: uid,
            caixa_inicial_centavos,
            abertura: ts,
            operador: operador.to_string(),
            maquina: Some(maquina.to_string()),
        })
    }

    async fn contar_pedidos(&self, turno_uid: &str) -> Result<i64, RepoErro> {
        let backend = self.db.get_database_backend();
        let row = self
            .db
            .query_one(Statement::from_sql_and_values(
                backend,
                "SELECT COUNT(*) AS n FROM pedido WHERE turno_uid = ? AND cancelado = 0",
                [turno_uid.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(row.and_then(|r| r.try_get::<i64>("", "n").ok()).unwrap_or(0))
    }

    async fn dados_fechamento(&self, turno_uid: &str) -> Result<DadosFechamento, RepoErro> {
        let backend = self.db.get_database_backend();
        let caixa: i64 = self
            .db
            .query_one(Statement::from_sql_and_values(
                backend,
                "SELECT caixa_inicial_centavos AS c FROM turno_operacao WHERE sync_uid = ?",
                [turno_uid.into()],
            ))
            .await
            .map_err(erro)?
            .and_then(|r| r.try_get::<i64>("", "c").ok())
            .unwrap_or(0);
        let vendas: i64 = self.contar_pedidos(turno_uid).await?;
        let rows = self
            .db
            .query_all(Statement::from_sql_and_values(
                backend,
                "SELECT pp.forma_id AS forma_id, pp.valor_centavos AS valor FROM pagamento_pedido pp \
                 JOIN pedido p ON p.numero = pp.pedido_numero \
                 WHERE p.turno_uid = ? AND p.cancelado = 0",
                [turno_uid.into()],
            ))
            .await
            .map_err(erro)?;
        let pagamentos = rows
            .into_iter()
            .filter_map(|r| {
                Some(Recebimento {
                    forma_id: r.try_get("", "forma_id").ok()?,
                    valor: Dinheiro::de_centavos(r.try_get::<i64>("", "valor").ok()?),
                })
            })
            .collect();
        Ok(DadosFechamento { caixa_inicial_centavos: caixa, pagamentos, qtd_vendas: vendas })
    }

    async fn dinheiro_forma_id(&self) -> Result<i64, RepoErro> {
        let backend = self.db.get_database_backend();
        let row = self
            .db
            .query_one(Statement::from_string(
                backend,
                "SELECT id FROM forma_pagamento WHERE chave = 'dinheiro' LIMIT 1".to_string(),
            ))
            .await
            .map_err(erro)?;
        Ok(row.and_then(|r| r.try_get::<i64>("", "id").ok()).unwrap_or(-1))
    }

    async fn encerrar(&self, turno_uid: &str, esperado: i64, conferido: i64, diferenca: i64) -> Result<(), RepoErro> {
        let backend = self.db.get_database_backend();
        let ts = agora();
        self.db
            .execute(Statement::from_sql_and_values(
                backend,
                "UPDATE turno_operacao SET status = 'encerrado', encerramento = ?, \
                 esperado_centavos = ?, conferido_centavos = ?, diferenca_centavos = ?, atualizado_em = ? \
                 WHERE sync_uid = ?",
                [ts.clone().into(), esperado.into(), conferido.into(), diferenca.into(), ts.into(), turno_uid.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(())
    }

    async fn turnos_podaveis(&self) -> Result<Vec<TurnoPodavel>, RepoErro> {
        let backend = self.db.get_database_backend();
        let rows = self
            .db
            .query_all(Statement::from_string(backend, super::poda_sql::CANDIDATOS.to_string()))
            .await
            .map_err(erro)?;
        Ok(rows
            .into_iter()
            .filter_map(|r| {
                Some(TurnoPodavel {
                    sync_uid: r.try_get("", "sync_uid").ok()?,
                    status: r.try_get("", "status").ok()?,
                    abertura: r.try_get("", "abertura").ok()?,
                })
            })
            .collect())
    }

    async fn turnos_encerrados_com_pendencias(&self, maquina: &str) -> Result<Vec<TurnoComPendencia>, RepoErro> {
        let backend = self.db.get_database_backend();
        let rows = self
            .db
            .query_all(Statement::from_sql_and_values(
                backend,
                "SELECT t.sync_uid AS sync_uid, t.operador AS operador FROM turno_operacao t \
                 WHERE t.maquina = ? AND t.status = 'encerrado' AND t.excluido_em IS NULL \
                   AND EXISTS (SELECT 1 FROM pedido p \
                                WHERE p.turno_uid = t.sync_uid AND p.sincronizado_em IS NULL) \
                 ORDER BY t.abertura",
                [maquina.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(rows
            .into_iter()
            .filter_map(|r| {
                Some(TurnoComPendencia {
                    sync_uid: r.try_get("", "sync_uid").ok()?,
                    operador: r.try_get("", "operador").unwrap_or_default(),
                })
            })
            .collect())
    }

    async fn pedidos_pendentes_do_turno(&self, turno_uid: &str) -> Result<Vec<i64>, RepoErro> {
        let backend = self.db.get_database_backend();
        let rows = self
            .db
            .query_all(Statement::from_sql_and_values(
                backend,
                "SELECT numero FROM pedido WHERE turno_uid = ? AND sincronizado_em IS NULL \
                 ORDER BY numero",
                [turno_uid.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(rows.into_iter().filter_map(|r| r.try_get::<i64>("", "numero").ok()).collect())
    }

    async fn mover_pedido(&self, numero: i64, destino_uid: &str, numero_no_turno: i64) -> Result<(), RepoErro> {
        let backend = self.db.get_database_backend();
        // `atualizado_em` bumpado: a mudança de turno precisa subir (LWW).
        self.db
            .execute(Statement::from_sql_and_values(
                backend,
                "UPDATE pedido SET turno_uid = ?, numero_no_turno = ?, atualizado_em = ? \
                 WHERE numero = ?",
                [destino_uid.into(), numero_no_turno.into(), agora().into(), numero.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(())
    }

    async fn podar_turno(&self, sync_uid: &str) -> Result<u64, RepoErro> {
        use sea_orm::TransactionTrait;
        let txn = self.db.begin().await.map_err(erro)?;
        let removidas = super::poda_sql::apagar_cluster(&txn, sync_uid).await.map_err(erro)?;
        txn.commit().await.map_err(erro)?;
        Ok(removidas)
    }

    async fn listar(&self, operador: &str) -> Result<Vec<TurnoHistorico>, RepoErro> {
        let backend = self.db.get_database_backend();
        let rows = self
            .db
            .query_all(Statement::from_sql_and_values(
                backend,
                "SELECT abertura, encerramento, status, esperado_centavos, conferido_centavos, diferenca_centavos \
                 FROM turno_operacao WHERE operador = ? AND excluido_em IS NULL \
                 ORDER BY abertura DESC LIMIT 50",
                [operador.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(rows
            .into_iter()
            .map(|r| TurnoHistorico {
                abertura: r.try_get("", "abertura").unwrap_or_default(),
                encerramento: r.try_get("", "encerramento").ok(),
                status: r.try_get("", "status").unwrap_or_default(),
                esperado_centavos: r.try_get("", "esperado_centavos").ok(),
                conferido_centavos: r.try_get("", "conferido_centavos").ok(),
                diferenca_centavos: r.try_get("", "diferenca_centavos").ok(),
            })
            .collect())
    }
}
