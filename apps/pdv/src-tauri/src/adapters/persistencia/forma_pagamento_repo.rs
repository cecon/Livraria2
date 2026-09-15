//! Implementação SeaORM da porta `FormaPagamentoRepo` (ADR-0013).
//! `em_uso` é SQL explícito — FKs não são enforced em runtime (FR-017).

use super::entities::forma_pagamento::{self, Entity as FormaEntity};
use crate::application::ports::{FormaPagamentoRepo, RepoErro};
use crate::domain::pagamento::FormaPagamento;
use async_trait::async_trait;
use sea_orm::{
    ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder,
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






}
