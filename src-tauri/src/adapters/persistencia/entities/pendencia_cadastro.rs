//! Entidade SeaORM da tabela `pendencia_cadastro` (adapter — ADR-0003).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "pendencia_cadastro")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub sessao_id: Option<i64>,
    pub codigo_lido: String,
    pub qtd: i64,
    pub resolvida: bool,
    pub criado_em: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
