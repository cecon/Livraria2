//! Implementação SeaORM da porta `DestinacaoRepo` (ADR-0014) — cadastro e `em_uso`.
//! A mecânica transacional de transferência/saldos vive em `destinacao_sql.rs`.

use super::destinacao_sql;
use super::entities::destinacao::destinacao::{self, ActiveModel, Entity as DestEntity};
use crate::application::ports::RepoErro;
use crate::application::ports_destinacao::{DestinacaoRepo, SaldoLivro, TransferenciaReg};
use crate::domain::destinacao::Destinacao;
use async_trait::async_trait;
use sea_orm::{
    ActiveModelTrait,
    ActiveValue::{NotSet, Set},
    ColumnTrait, ConnectionTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder,
    Statement, TransactionTrait,
};

pub struct SeaDestinacaoRepo {
    db: DatabaseConnection,
}

impl SeaDestinacaoRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

fn para_dominio(m: destinacao::Model) -> Destinacao {
    Destinacao {
        id: m.id,
        nome: m.nome,
        de_sistema: m.de_sistema,
        ativa: m.ativa,
        ordem: m.ordem,
    }
}

#[async_trait]
impl DestinacaoRepo for SeaDestinacaoRepo {
    async fn listar(&self) -> Result<Vec<Destinacao>, RepoErro> {
        let ms = DestEntity::find()
            .order_by_asc(destinacao::Column::Ordem)
            .order_by_asc(destinacao::Column::Id)
            .all(&self.db)
            .await
            .map_err(erro)?;
        Ok(ms.into_iter().map(para_dominio).collect())
    }

    async fn listar_ativas(&self) -> Result<Vec<Destinacao>, RepoErro> {
        let ms = DestEntity::find()
            .filter(destinacao::Column::Ativa.eq(true))
            .order_by_asc(destinacao::Column::Ordem)
            .order_by_asc(destinacao::Column::Id)
            .all(&self.db)
            .await
            .map_err(erro)?;
        Ok(ms.into_iter().map(para_dominio).collect())
    }

    async fn por_id(&self, id: i64) -> Result<Option<Destinacao>, RepoErro> {
        let m = DestEntity::find_by_id(id).one(&self.db).await.map_err(erro)?;
        Ok(m.map(para_dominio))
    }

    /// SQL explícito — FKs não são enforced em runtime (memória do projeto).
    async fn em_uso(&self, id: i64) -> Result<bool, RepoErro> {
        let row = self
            .db
            .query_one(Statement::from_sql_and_values(
                self.db.get_database_backend(),
                "SELECT (SELECT count(*) FROM destinacao_saldo WHERE destinacao_id = ?1 AND qtd > 0)
                      + (SELECT count(*) FROM alocacao_venda WHERE destinacao_id = ?1)
                      + (SELECT count(*) FROM transferencia_destinacao
                         WHERE de_destinacao_id = ?1 OR para_destinacao_id = ?1) AS n",
                [id.into()],
            ))
            .await
            .map_err(erro)?;
        let n: i64 = row.and_then(|r| r.try_get("", "n").ok()).unwrap_or(0);
        Ok(n > 0)
    }

    async fn criar(&self, nome: &str, nome_norm: &str, ordem: i64) -> Result<Destinacao, RepoErro> {
        let am = ActiveModel {
            id: NotSet,
            nome: Set(nome.trim().to_string()),
            nome_norm: Set(nome_norm.to_string()),
            de_sistema: Set(false),
            ativa: Set(true),
            ordem: Set(ordem),
        };
        let m = am.insert(&self.db).await.map_err(erro)?;
        Ok(para_dominio(m))
    }

    async fn renomear(&self, id: i64, nome: &str, nome_norm: &str) -> Result<(), RepoErro> {
        self.db
            .execute(Statement::from_sql_and_values(
                self.db.get_database_backend(),
                "UPDATE destinacao SET nome = ?, nome_norm = ? WHERE id = ?",
                [nome.trim().into(), nome_norm.into(), id.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(())
    }

    async fn definir_ativa(&self, id: i64, ativa: bool) -> Result<(), RepoErro> {
        self.db
            .execute(Statement::from_sql_and_values(
                self.db.get_database_backend(),
                "UPDATE destinacao SET ativa = ? WHERE id = ?",
                [ativa.into(), id.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(())
    }

    /// Reordena as livres a partir de 1 — a Loja fica fixa em 0 (FR-002).
    async fn reordenar(&self, ids: &[i64]) -> Result<(), RepoErro> {
        for (pos, id) in ids.iter().enumerate() {
            self.db
                .execute(Statement::from_sql_and_values(
                    self.db.get_database_backend(),
                    "UPDATE destinacao SET ordem = ? WHERE id = ? AND de_sistema = 0",
                    [(pos as i64 + 1).into(), (*id).into()],
                ))
                .await
                .map_err(erro)?;
        }
        Ok(())
    }

    async fn excluir(&self, id: i64) -> Result<(), RepoErro> {
        DestEntity::delete_by_id(id).exec(&self.db).await.map_err(erro)?;
        Ok(())
    }

    async fn saldos_livro(&self, livro_codigo: &str) -> Result<SaldoLivro, RepoErro> {
        destinacao_sql::saldos_livro(&self.db, livro_codigo).await.map_err(erro)
    }

    async fn transferir(
        &self,
        livro_codigo: &str,
        de: Option<i64>,
        para: Option<i64>,
        qtd: i64,
        motivo: Option<String>,
    ) -> Result<SaldoLivro, RepoErro> {
        let txn = self.db.begin().await.map_err(erro)?;
        destinacao_sql::transferir(&txn, livro_codigo, de, para, qtd, motivo)
            .await
            .map_err(erro)?;
        txn.commit().await.map_err(erro)?;
        destinacao_sql::saldos_livro(&self.db, livro_codigo).await.map_err(erro)
    }

    async fn transferencias_livro(
        &self,
        livro_codigo: &str,
    ) -> Result<Vec<TransferenciaReg>, RepoErro> {
        destinacao_sql::transferencias_livro(&self.db, livro_codigo)
            .await
            .map_err(erro)
    }
}
