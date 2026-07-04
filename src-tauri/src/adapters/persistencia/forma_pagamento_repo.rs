//! Implementação SeaORM da porta `FormaPagamentoRepo` (ADR-0013).
//! `em_uso` é SQL explícito — FKs não são enforced em runtime (FR-017).

use super::entities::forma_pagamento::{self, ActiveModel, Entity as FormaEntity};
use crate::application::ports::{FormaPagamentoRepo, RepoErro};
use crate::domain::pagamento::FormaPagamento;
use async_trait::async_trait;
use sea_orm::{
    ActiveModelTrait,
    ActiveValue::{NotSet, Set},
    ColumnTrait, ConnectionTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder,
    Statement,
};

pub struct SeaFormaPagamentoRepo {
    db: DatabaseConnection,
}

impl SeaFormaPagamentoRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

fn para_dominio(m: forma_pagamento::Model) -> FormaPagamento {
    FormaPagamento {
        id: m.id,
        chave: m.chave,
        rotulo: m.rotulo,
        de_sistema: m.de_sistema,
        ativa: m.ativa,
        ordem: m.ordem,
    }
}

#[async_trait]
impl FormaPagamentoRepo for SeaFormaPagamentoRepo {
    async fn listar(&self) -> Result<Vec<FormaPagamento>, RepoErro> {
        let ms = FormaEntity::find()
            .order_by_asc(forma_pagamento::Column::Ordem)
            .order_by_asc(forma_pagamento::Column::Id)
            .all(&self.db)
            .await
            .map_err(erro)?;
        Ok(ms.into_iter().map(para_dominio).collect())
    }

    async fn listar_ativas(&self) -> Result<Vec<FormaPagamento>, RepoErro> {
        let ms = FormaEntity::find()
            .filter(forma_pagamento::Column::Ativa.eq(true))
            .order_by_asc(forma_pagamento::Column::Ordem)
            .order_by_asc(forma_pagamento::Column::Id)
            .all(&self.db)
            .await
            .map_err(erro)?;
        Ok(ms.into_iter().map(para_dominio).collect())
    }

    async fn por_id(&self, id: i64) -> Result<Option<FormaPagamento>, RepoErro> {
        let m = FormaEntity::find_by_id(id).one(&self.db).await.map_err(erro)?;
        Ok(m.map(para_dominio))
    }

    async fn por_chave(&self, chave: &str) -> Result<Option<FormaPagamento>, RepoErro> {
        let m = FormaEntity::find()
            .filter(forma_pagamento::Column::Chave.eq(chave))
            .one(&self.db)
            .await
            .map_err(erro)?;
        Ok(m.map(para_dominio))
    }

    async fn em_uso(&self, id: i64) -> Result<bool, RepoErro> {
        let row = self
            .db
            .query_one(Statement::from_sql_and_values(
                self.db.get_database_backend(),
                "SELECT count(*) AS n FROM pagamento_pedido WHERE forma_id = ?",
                [id.into()],
            ))
            .await
            .map_err(erro)?;
        let n: i64 = row
            .and_then(|r| r.try_get("", "n").ok())
            .unwrap_or(0);
        Ok(n > 0)
    }

    async fn criar(
        &self,
        chave: &str,
        rotulo: &str,
        ativa: bool,
        ordem: i64,
    ) -> Result<FormaPagamento, RepoErro> {
        let am = ActiveModel {
            id: NotSet,
            chave: Set(chave.to_string()),
            rotulo: Set(rotulo.trim().to_string()),
            de_sistema: Set(false),
            ativa: Set(ativa),
            ordem: Set(ordem),
        };
        let m = am.insert(&self.db).await.map_err(erro)?;
        Ok(para_dominio(m))
    }

    async fn renomear(&self, id: i64, rotulo: &str) -> Result<(), RepoErro> {
        FormaEntity::update_many()
            .col_expr(
                forma_pagamento::Column::Rotulo,
                sea_orm::sea_query::Expr::value(rotulo.trim().to_string()),
            )
            .filter(forma_pagamento::Column::Id.eq(id))
            .exec(&self.db)
            .await
            .map_err(erro)?;
        Ok(())
    }

    async fn definir_ativa(&self, id: i64, ativa: bool) -> Result<(), RepoErro> {
        FormaEntity::update_many()
            .col_expr(
                forma_pagamento::Column::Ativa,
                sea_orm::sea_query::Expr::value(ativa),
            )
            .filter(forma_pagamento::Column::Id.eq(id))
            .exec(&self.db)
            .await
            .map_err(erro)?;
        Ok(())
    }

    async fn reordenar(&self, ids: &[i64]) -> Result<(), RepoErro> {
        for (pos, id) in ids.iter().enumerate() {
            self.db
                .execute(Statement::from_sql_and_values(
                    self.db.get_database_backend(),
                    "UPDATE forma_pagamento SET ordem = ? WHERE id = ?",
                    [(pos as i64).into(), (*id).into()],
                ))
                .await
                .map_err(erro)?;
        }
        Ok(())
    }

    async fn excluir(&self, id: i64) -> Result<(), RepoErro> {
        FormaEntity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(erro)?;
        Ok(())
    }
}
