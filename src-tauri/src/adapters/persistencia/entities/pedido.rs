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
    pub cancelado: bool,
    pub cancelado_em: Option<String>,
    /// Operador que realizou a venda (feature 007, FR-023). Nullable.
    pub operador: Option<String>,
    /// Turno a que a venda pertence (feature 009/013). Nulo em venda legada.
    pub turno_uid: Option<String>,
    /// Pedido Nº DENTRO do turno (1..n) — o número exibido (FR-016). O `numero`
    /// segue contínuo como chave; nulo em venda legada.
    pub numero_no_turno: Option<i64>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
