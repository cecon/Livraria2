//! Entidade SeaORM da tabela `item_lancamento` (adapter — ADR-0003).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "item_lancamento")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub lancamento_id: i64,
    pub livro_id: i64,
    pub qtd: i64,
    pub custo_unit_centavos: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
