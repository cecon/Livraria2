//! Entidade SeaORM da tabela `pedido` (adapter — ADR-0003).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "pedido")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub numero: i64,
    pub cliente: String,
    pub turno: String,
    pub data: String,
    pub total_centavos: i64,
    pub val_cartao: i64,
    pub val_dinheiro: i64,
    pub val_pix: i64,
    pub val_ministerio: i64,
    pub val_vale: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
