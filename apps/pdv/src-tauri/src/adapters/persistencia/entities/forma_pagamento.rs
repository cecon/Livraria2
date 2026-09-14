//! Entidade SeaORM da tabela `forma_pagamento` (cadastro — ADR-0013).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "forma_pagamento")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    /// Identidade estável em snake_case; imutável (troco/legado/seed — FR-001a).
    pub chave: String,
    pub rotulo: String,
    pub de_sistema: bool,
    pub ativa: bool,
    pub ordem: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
