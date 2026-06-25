//! Entidade SeaORM da tabela `lancamento_entrada` (adapter — ADR-0003).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "lancamento_entrada")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub fornecedor_id: Option<i64>,
    pub numero: Option<String>,
    pub data: String,
    pub status: String,
    pub finalizada_em: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
