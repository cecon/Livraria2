//! Entidade SeaORM da tabela `item_contagem` (adapter — ADR-0003).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "item_contagem")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub sessao_id: i64,
    pub livro_codigo: String,
    pub qtd_contada: i64,
    pub qtd_sistema: Option<i64>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
