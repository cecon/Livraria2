//! Adapter SeaORM da porta `TurnoRepo` (feature 009, ADR-0021). Persiste em
//! `turno_operacao` (m009), que sincroniza com a nuvem por `sync_uid`.

use crate::application::ports::RepoErro;
use crate::application::ports_turno::{DadosFechamento, MovimentoCaixaInfo, TurnoAbertoInfo, TurnoHistorico, TurnoRepo};
use crate::domain::dinheiro::Dinheiro;
use crate::domain::pedido::Recebimento;
use crate::machine_config::MachineConfig;
use async_trait::async_trait;
use chrono::Local;
use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement, TransactionTrait};

pub struct SeaTurnoRepo {
    db: DatabaseConnection,
    machine: Option<MachineConfig>,
}

impl SeaTurnoRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db, machine: None }
    }

    pub fn with_machine(db: DatabaseConnection, machine: MachineConfig) -> Self {
        Self { db, machine: Some(machine) }
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
        let (where_clause, identity) = match &self.machine {
            Some(machine) => ("pdv_uid = ?", machine.pdv_uid.as_str()),
            None => ("operador = ?", operador),
        };
        let row = self
            .db
            .query_one(Statement::from_sql_and_values(
                backend,
                format!("SELECT sync_uid, caixa_inicial_centavos, abertura FROM turno_operacao \
                 WHERE {where_clause} AND status = 'aberto' AND excluido_em IS NULL \
                 ORDER BY abertura DESC LIMIT 1"),
                [identity.into()],
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
        let tx = self.db.begin().await.map_err(erro)?;
        let backend = tx.get_database_backend();
        // UUID v4 gerado em SQL (mesmo gerador da réplica — m008), lido de volta.
        let uid: String = tx
            .query_one(Statement::from_string(
                backend,
                format!("SELECT ({}) AS uid", crate::migration::m008::UUID_V4),
            ))
            .await
            .map_err(erro)?
            .and_then(|r| r.try_get::<String>("", "uid").ok())
            .ok_or_else(|| RepoErro::Persistencia("falha ao gerar sync_uid".into()))?;
        let ts = agora();
        if let Some(machine) = &self.machine {
            tx.execute(Statement::from_sql_and_values(backend,
                "INSERT INTO maquina_pdv(uid,nome) VALUES(?,?)
                 ON CONFLICT(uid) DO UPDATE SET nome=excluded.nome",
                [machine.pdv_uid.clone().into(), machine.nome.clone().into()]))
                .await.map_err(erro)?;
        }
        tx
            .execute(Statement::from_sql_and_values(
                backend,
                "INSERT INTO turno_operacao \
                 (sync_uid, operador, caixa_inicial_centavos, status, abertura, origem, atualizado_em, pdv_uid) \
                 VALUES (?, ?, ?, 'aberto', ?, 'pdv', ?, ?)",
                [uid.clone().into(), operador.into(), caixa_inicial_centavos.into(), ts.clone().into(),
                    ts.clone().into(), self.machine.as_ref().map(|m| m.pdv_uid.clone()).into()],
            ))
            .await
            .map_err(erro)?;
        tx.commit().await.map_err(erro)?;
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
        let movimentos = self.listar_movimentos(turno_uid).await?;
        let suprimentos_centavos = movimentos.iter().filter(|m| m.tipo == "suprimento").map(|m| m.valor_centavos).sum();
        let sangrias_centavos = movimentos.iter().filter(|m| m.tipo == "sangria").map(|m| m.valor_centavos).sum();
        Ok(DadosFechamento { caixa_inicial_centavos: caixa, pagamentos, qtd_vendas: vendas,
            suprimentos_centavos, sangrias_centavos })
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

    async fn registrar_movimento(&self, turno_uid: &str, operador: &str, tipo: &str, valor_centavos: i64, motivo: &str) -> Result<(), RepoErro> {
        let tx = self.db.begin().await.map_err(erro)?;
        let backend = tx.get_database_backend();
        let row = tx.query_one(Statement::from_sql_and_values(backend,
            "SELECT t.caixa_inicial_centavos
              + COALESCE((SELECT SUM(pp.valor_centavos) FROM pagamento_pedido pp
                  JOIN pedido p ON p.numero=pp.pedido_numero
                  JOIN forma_pagamento f ON f.id=pp.forma_id
                  WHERE p.turno_uid=t.sync_uid AND p.cancelado=0 AND f.chave='dinheiro'), 0)
              + COALESCE((SELECT SUM(CASE WHEN m.tipo='suprimento' THEN m.valor_centavos ELSE -m.valor_centavos END)
                  FROM caixa_movimento m WHERE m.turno_uid=t.sync_uid), 0) AS saldo
             FROM turno_operacao t WHERE t.sync_uid=? AND t.operador=? AND t.status='aberto' AND t.excluido_em IS NULL",
            [turno_uid.into(), operador.into()])).await.map_err(erro)?;
        let saldo = row.ok_or_else(|| RepoErro::Persistencia("turno aberto do operador nao encontrado".into()))?
            .try_get::<i64>("", "saldo").map_err(erro)?;
        if tipo == "sangria" && valor_centavos > saldo {
            return Err(RepoErro::Persistencia("sangria maior que o dinheiro disponivel no caixa".into()));
        }
        let uid: String = tx.query_one(Statement::from_string(backend,
            format!("SELECT ({}) AS uid", crate::migration::m008::UUID_V4)))
            .await.map_err(erro)?.ok_or_else(|| RepoErro::Persistencia("falha ao gerar identificador".into()))?
            .try_get("", "uid").map_err(erro)?;
        tx.execute(Statement::from_sql_and_values(backend,
            "INSERT INTO caixa_movimento(sync_uid,turno_uid,operador,tipo,valor_centavos,motivo,criado_em)
             VALUES(?,?,?,?,?,?,?)",
            [uid.into(), turno_uid.into(), operador.into(), tipo.into(), valor_centavos.into(), motivo.into(), agora().into()]))
            .await.map_err(erro)?;
        tx.commit().await.map_err(erro)
    }

    async fn listar_movimentos(&self, turno_uid: &str) -> Result<Vec<MovimentoCaixaInfo>, RepoErro> {
        let rows = self.db.query_all(Statement::from_sql_and_values(self.db.get_database_backend(),
            "SELECT sync_uid,tipo,valor_centavos,motivo,operador,criado_em FROM caixa_movimento
             WHERE turno_uid=? ORDER BY criado_em DESC, sync_uid DESC", [turno_uid.into()]))
            .await.map_err(erro)?;
        rows.into_iter().map(|r| Ok(MovimentoCaixaInfo {
            sync_uid: r.try_get("", "sync_uid").map_err(erro)?,
            tipo: r.try_get("", "tipo").map_err(erro)?,
            valor_centavos: r.try_get("", "valor_centavos").map_err(erro)?,
            motivo: r.try_get("", "motivo").map_err(erro)?,
            operador: r.try_get("", "operador").map_err(erro)?,
            criado_em: r.try_get("", "criado_em").map_err(erro)?,
        })).collect()
    }

    async fn encerrar(&self, turno_uid: &str, esperado: i64, conferido: i64, diferenca: i64) -> Result<(), RepoErro> {
        let backend = self.db.get_database_backend();
        let ts = agora();
        let resultado = self.db
            .execute(Statement::from_sql_and_values(
                backend,
                "UPDATE turno_operacao SET status = 'encerrado', encerramento = ?, \
                 esperado_centavos = ?, conferido_centavos = ?, diferenca_centavos = ?, atualizado_em = ? \
                 WHERE sync_uid = ? AND status = 'aberto'",
                [ts.clone().into(), esperado.into(), conferido.into(), diferenca.into(), ts.into(), turno_uid.into()],
            ))
            .await
            .map_err(erro)?;
        if resultado.rows_affected() != 1 {
            return Err(RepoErro::Persistencia("turno nao esta aberto".into()));
        }
        Ok(())
    }

    async fn listar(&self, operador: &str) -> Result<Vec<TurnoHistorico>, RepoErro> {
        let backend = self.db.get_database_backend();
        let (where_clause, values) = match &self.machine {
            Some(machine) => (
                "(pdv_uid = ? OR (pdv_uid IS NULL AND operador = ?))",
                vec![machine.pdv_uid.clone().into(), operador.into()],
            ),
            None => ("operador = ?", vec![operador.into()]),
        };
        let rows = self
            .db
            .query_all(Statement::from_sql_and_values(
                backend,
                format!("SELECT abertura, encerramento, status, esperado_centavos, conferido_centavos, diferenca_centavos \
                 FROM turno_operacao WHERE {where_clause} AND excluido_em IS NULL \
                 ORDER BY abertura DESC LIMIT 50"),
                values,
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

#[cfg(test)]
mod testes {
    use super::*;
    use crate::application::turno;
    use sea_orm::Database;

    #[tokio::test]
    async fn turno_aberto_pertence_a_maquina_nao_ao_operador() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        crate::adapters::persistencia::inicializar_schema(&db).await.unwrap();
        let machine = |uid: &str| MachineConfig {
            api_url: "https://example.test".into(), pdv_uid: uid.into(), nome: "Caixa".into(),
        };
        let caixa1 = SeaTurnoRepo::with_machine(db.clone(), machine("m1"));
        let aberto = turno::abrir(&caixa1, "operador-a", 1_000).await.unwrap();
        assert_eq!(caixa1.turno_aberto("operador-b").await.unwrap().unwrap().sync_uid, aberto.sync_uid);
        assert!(turno::abrir(&caixa1, "operador-b", 0).await.is_err());
        let caixa2 = SeaTurnoRepo::with_machine(db.clone(), machine("m2"));
        assert!(caixa2.turno_aberto("operador-a").await.unwrap().is_none());
        assert_eq!(caixa1.listar("operador-b").await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn movimentos_entram_no_fechamento_e_param_apos_encerrar() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        crate::adapters::persistencia::inicializar_schema(&db).await.unwrap();
        let repo = SeaTurnoRepo::new(db);
        assert!(turno::abrir(&repo, "op", -1).await.is_err());
        let aberto = turno::abrir(&repo, "op", 10_000).await.unwrap();
        turno::registrar_movimento(&repo, &aberto.sync_uid, "op", "suprimento", 5_000, "troco").await.unwrap();
        turno::registrar_movimento(&repo, &aberto.sync_uid, "op", "sangria", 3_000, "cofre").await.unwrap();
        let r = turno::resumo(&repo, &aberto.sync_uid).await.unwrap();
        assert_eq!((r.suprimentos_centavos, r.sangrias_centavos, r.esperado_dinheiro_centavos), (5_000, 3_000, 12_000));
        assert_eq!(repo.listar_movimentos(&aberto.sync_uid).await.unwrap().len(), 2);
        assert!(turno::registrar_movimento(&repo, &aberto.sync_uid, "op", "sangria", 12_001, "excesso").await.is_err());
        let f = turno::encerrar(&repo, &aberto.sync_uid, 12_000).await.unwrap();
        assert_eq!(f.diferenca_centavos, 0);
        assert!(turno::encerrar(&repo, &aberto.sync_uid, 12_000).await.is_err());
        assert!(turno::registrar_movimento(&repo, &aberto.sync_uid, "op", "suprimento", 1, "tarde").await.is_err());
    }
}
