//! Adapter SeaORM da porta `TurnoRepo` (feature 009, ADR-0021). Persiste em
//! `turno_operacao` (m009), que sincroniza com a nuvem por `sync_uid`.

use crate::application::ports::RepoErro;
use crate::application::ports_turno::{DadosFechamento, TurnoAbertoInfo, TurnoHistorico, TurnoRepo};
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
    async fn turno_aberto(&self, operador: &str) -> Result<Option<TurnoAbertoInfo>, RepoErro> {
        let backend = self.db.get_database_backend();
        let row = self
            .db
            .query_one(Statement::from_sql_and_values(
                backend,
                "SELECT sync_uid, caixa_inicial_centavos, abertura FROM turno_operacao \
                 WHERE operador = ? AND status = 'aberto' AND excluido_em IS NULL \
                 ORDER BY abertura DESC LIMIT 1",
                [operador.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(row.and_then(|r| {
            Some(TurnoAbertoInfo {
                sync_uid: r.try_get("", "sync_uid").ok()?,
                caixa_inicial_centavos: r.try_get("", "caixa_inicial_centavos").ok()?,
                abertura: r.try_get("", "abertura").ok()?,
            })
        }))
    }

    async fn abrir(&self, operador: &str, caixa_inicial_centavos: i64) -> Result<TurnoAbertoInfo, RepoErro> {
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
                 (sync_uid, operador, caixa_inicial_centavos, status, abertura, origem, atualizado_em) \
                 VALUES (?, ?, ?, 'aberto', ?, 'pdv', ?)",
                [uid.clone().into(), operador.into(), caixa_inicial_centavos.into(), ts.clone().into(), ts.clone().into()],
            ))
            .await
            .map_err(erro)?;
        Ok(TurnoAbertoInfo { sync_uid: uid, caixa_inicial_centavos, abertura: ts })
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
