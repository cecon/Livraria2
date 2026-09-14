//! Entidade SeaORM da tabela `pagamento_pedido` (junção venda↔forma — ADR-0013).
//! Esparsa: só existe linha quando o valor recebido na forma é > 0.

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "pagamento_pedido")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub pedido_numero: i64,
    #[sea_orm(primary_key, auto_increment = false)]
    pub forma_id: i64,
    pub valor_centavos: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
