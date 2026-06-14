//! Entidade SeaORM da tabela `livro` (adapter — fica FORA do domínio, ADR-0003).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "livro")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub codigo: String,
    pub titulo: String,
    pub autor: Option<String>,
    pub preco_centavos: i64,
    pub categoria: i64,
    pub estoque: i64,
    pub descricao: Option<String>,
    pub busca_norm: String,
    pub ativo: bool,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
