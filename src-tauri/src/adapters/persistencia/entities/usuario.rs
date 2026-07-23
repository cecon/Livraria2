//! Entidade SeaORM da tabela `usuario` (adapter — ADR-0003).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "usuario")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub usuario: String,
    pub senha_hash: String,
    pub nome: Option<String>,
    /// Perfil de acesso (m010): `operador` | `admin`. Ver `livraria_domain::usuario::Perfil`.
    pub perfil: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
