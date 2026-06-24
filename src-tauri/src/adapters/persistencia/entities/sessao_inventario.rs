//! Entidade SeaORM da tabela `sessao_inventario` (adapter — ADR-0003).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "sessao_inventario")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub modo: String,
    pub rotulo: Option<String>,
    pub status: String,
    pub aberta_em: String,
    pub fechada_em: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
