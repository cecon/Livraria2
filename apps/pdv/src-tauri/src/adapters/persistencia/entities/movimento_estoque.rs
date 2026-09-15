//! Entidade SeaORM da tabela `movimento_estoque` (ledger append-only, ADR-0008).

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "movimento_estoque")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub livro_id: i64,
    pub tipo: String,
    pub qtd: i64,
    pub custo_unit_centavos: Option<i64>,
    pub fornecedor: Option<String>,
    pub motivo: Option<String>,
    pub referencia: Option<String>,
    pub criado_em: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
