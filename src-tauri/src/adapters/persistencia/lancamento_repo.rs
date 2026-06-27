//! Implementação SeaORM da porta `LancamentoRepo` (ADR-0011). Rascunho retomável
//! e finalização atômica/idempotente (reusa o helper de entrada — D3a).

use super::entities::lancamento_entrada::{self, Entity as LancEntity};
use super::lancamento_sql::{aplicar_cancelamento, aplicar_finalizacao, detalhe, pagina};
use crate::application::ports::RepoErro;
use crate::application::ports_compras::{LancamentoDetalhe, LancamentoRepo, PaginaLancamentos};
use async_trait::async_trait;
use chrono::Local;
use sea_orm::{
    ActiveValue::{NotSet, Set},
    ConnectionTrait, DatabaseConnection, DbErr, EntityTrait, Statement, TransactionTrait,
};

pub struct SeaLancamentoRepo {
    db: DatabaseConnection,
}

impl SeaLancamentoRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

fn hoje() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

async fn exec(db: &impl ConnectionTrait, sql: &str, vals: Vec<sea_orm::Value>) -> Result<(), DbErr> {
    db.execute(Statement::from_sql_and_values(db.get_database_backend(), sql, vals))
        .await?;
    Ok(())
}

#[async_trait]
impl LancamentoRepo for SeaLancamentoRepo {
    async fn criar(&self, fornecedor_id: Option<i64>) -> Result<LancamentoDetalhe, RepoErro> {
        let am = lancamento_entrada::ActiveModel {
            id: NotSet,
            fornecedor_id: Set(fornecedor_id),
            numero: Set(None),
            data: Set(hoje()),
            status: Set("rascunho".into()),
            finalizada_em: Set(None),
        };
        let res = LancEntity::insert(am).exec(&self.db).await.map_err(erro)?;
        self.obter(res.last_insert_id)
            .await?
            .ok_or_else(|| RepoErro::Persistencia("falha ao criar nota".into()))
    }

    async fn obter(&self, id: i64) -> Result<Option<LancamentoDetalhe>, RepoErro> {
        detalhe(&self.db, id).await.map_err(erro)
    }

    async fn listar(&self, limite: i64, offset: i64) -> Result<PaginaLancamentos, RepoErro> {
        pagina(&self.db, limite, offset).await.map_err(erro)
    }

    async fn definir_fornecedor(
        &self,
        id: i64,
        fornecedor_id: i64,
        numero: Option<String>,
    ) -> Result<(), RepoErro> {
        exec(
            &self.db,
            "UPDATE lancamento_entrada SET fornecedor_id = ?, numero = ?
             WHERE id = ? AND status = 'rascunho'",
            vec![fornecedor_id.into(), numero.into(), id.into()],
        )
        .await
        .map_err(erro)
    }

    async fn adicionar_item(
        &self,
        id: i64,
        livro_codigo: &str,
        qtd: i64,
        custo_unit_centavos: i64,
    ) -> Result<LancamentoDetalhe, RepoErro> {
        // UNIQUE(nota, livro): se já existe, soma a qtd e atualiza o custo unitário.
        let afetou = self
            .db
            .execute(Statement::from_sql_and_values(
                self.db.get_database_backend(),
                "UPDATE item_lancamento SET qtd = qtd + ?, custo_unit_centavos = ?
                 WHERE lancamento_id = ? AND livro_id = (SELECT id FROM livro WHERE codigo = ?)",
                [
                    qtd.into(),
                    custo_unit_centavos.into(),
                    id.into(),
                    livro_codigo.into(),
                ],
            ))
            .await
            .map_err(erro)?;
        if afetou.rows_affected() == 0 {
            exec(
                &self.db,
                "INSERT INTO item_lancamento (lancamento_id, livro_id, qtd, custo_unit_centavos)
                 VALUES (?, (SELECT id FROM livro WHERE codigo = ?), ?, ?)",
                vec![id.into(), livro_codigo.into(), qtd.into(), custo_unit_centavos.into()],
            )
            .await
            .map_err(erro)?;
        }
        self.obter(id)
            .await?
            .ok_or_else(|| RepoErro::Persistencia("nota não encontrada".into()))
    }

    async fn remover_item(&self, id: i64, item_id: i64) -> Result<LancamentoDetalhe, RepoErro> {
        exec(
            &self.db,
            "DELETE FROM item_lancamento WHERE id = ? AND lancamento_id = ?",
            vec![item_id.into(), id.into()],
        )
        .await
        .map_err(erro)?;
        self.obter(id)
            .await?
            .ok_or_else(|| RepoErro::Persistencia("nota não encontrada".into()))
    }

    async fn excluir(&self, id: i64) -> Result<(), RepoErro> {
        let txn = self.db.begin().await.map_err(erro)?;
        exec(
            &txn,
            "DELETE FROM item_lancamento WHERE lancamento_id = ?
             AND lancamento_id IN (SELECT id FROM lancamento_entrada WHERE status = 'rascunho')",
            vec![id.into()],
        )
        .await
        .map_err(erro)?;
        exec(
            &txn,
            "DELETE FROM lancamento_entrada WHERE id = ? AND status = 'rascunho'",
            vec![id.into()],
        )
        .await
        .map_err(erro)?;
        txn.commit().await.map_err(erro)?;
        Ok(())
    }

    async fn status(&self, id: i64) -> Result<Option<String>, RepoErro> {
        let row = self
            .db
            .query_one(Statement::from_sql_and_values(
                self.db.get_database_backend(),
                "SELECT status FROM lancamento_entrada WHERE id = ?",
                [id.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(row.and_then(|r| r.try_get::<String>("", "status").ok()))
    }

    async fn finalizar(&self, id: i64) -> Result<LancamentoDetalhe, RepoErro> {
        // Idempotente (FR-017/SC-006): só aplica em rascunho; finalizada/cancelada não reaplicam.
        if self.status(id).await?.as_deref() != Some("rascunho") {
            return self
                .obter(id)
                .await?
                .ok_or_else(|| RepoErro::Persistencia("nota não encontrada".into()));
        }
        let txn = self.db.begin().await.map_err(erro)?;
        aplicar_finalizacao(&txn, id).await.map_err(erro)?;
        txn.commit().await.map_err(erro)?;
        self.obter(id)
            .await?
            .ok_or_else(|| RepoErro::Persistencia("nota não encontrada".into()))
    }

    async fn cancelar(&self, id: i64) -> Result<LancamentoDetalhe, RepoErro> {
        match self.status(id).await?.as_deref() {
            Some("finalizada") => {
                let txn = self.db.begin().await.map_err(erro)?;
                aplicar_cancelamento(&txn, id).await.map_err(erro)?;
                txn.commit().await.map_err(erro)?;
            }
            Some("cancelada") => {} // idempotente
            Some("rascunho") => {
                return Err(RepoErro::Persistencia(
                    "rascunho não finalizado — use excluir".into(),
                ))
            }
            _ => return Err(RepoErro::Persistencia("nota não encontrada".into())),
        }
        self.obter(id)
            .await?
            .ok_or_else(|| RepoErro::Persistencia("nota não encontrada".into()))
    }
}
