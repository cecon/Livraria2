//! Entidade SeaORM da tabela `fornecedor` (adapter — ADR-0003).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "fornecedor")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub nome: String,
    pub nome_norm: String,
    pub documento: Option<String>,
    pub telefone: Option<String>,
    pub email: Option<String>,
    pub observacoes: Option<String>,
    pub ativo: bool,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
