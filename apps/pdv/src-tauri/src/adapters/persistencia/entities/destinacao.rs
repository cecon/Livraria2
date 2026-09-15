//! Entidades SeaORM da feature 006 (destinações — ADR-0014): cadastro, saldo
//! carimbado, transferência e alocação de venda. Vivem no adapter (ADR-0003).

pub mod destinacao {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "destinacao")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub id: i64,
        pub nome: String,
        /// Normalizado (caixa/acentos/trim) — unicidade entre ativas na aplicação.
        pub nome_norm: String,
        /// 1 = "Loja" (padrão do sistema): não exclui/desativa/reordena; sempre 1ª.
        pub de_sistema: bool,
        pub ativa: bool,
        pub ordem: i64,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod destinacao_saldo {
    use sea_orm::entity::prelude::*;

    /// Carimbo por livro × destinação. O saldo livre é o resíduo
    /// (`estoque − Σ carimbos`) e nunca é armazenado.
    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "destinacao_saldo")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub livro_id: i64,
        #[sea_orm(primary_key, auto_increment = false)]
        pub destinacao_id: i64,
        pub qtd: i64,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod transferencia_destinacao {
    use sea_orm::entity::prelude::*;

    /// Trilha de auditoria dos carimbos — único mecanismo de criação (D5).
    /// `None` em de/para = saldo livre.
    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "transferencia_destinacao")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub id: i64,
        pub livro_id: i64,
        pub de_destinacao_id: Option<i64>,
        pub para_destinacao_id: Option<i64>,
        pub qtd: i64,
        pub motivo: Option<String>,
        pub criado_em: String,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod alocacao_venda {
    use sea_orm::entity::prelude::*;

    /// Consumo de carimbo por item de venda (inclusive carimbo Loja — D3).
    /// Consumo do saldo livre não gera linha.
    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "alocacao_venda")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub id: i64,
        pub pedido_numero: i64,
        pub item_id: i64,
        pub destinacao_id: i64,
        pub qtd: i64,
        pub valor_centavos: i64,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}
