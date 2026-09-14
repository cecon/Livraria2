//! Entidade SeaORM da tabela `item_pedido` (adapter — ADR-0003).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "item_pedido")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub pedido_numero: i64,
    pub codigo: String,
    pub titulo: String,
    pub preco_centavos: i64,
    pub qtd: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
