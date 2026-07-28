//! m011 (feature 011): marcador local de processamento de estoque do pedido.
//!
//! O PDV continua offline-first, mas a baixa oficial e o estorno contabil passam a
//! ocorrer na nuvem. Pedidos legados ficam como `incorporada` para nao reprocessar
//! historico; novas vendas locais sao marcadas como `pronta` no momento do registro.

use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};

async fn add_coluna(db: &DatabaseConnection, tabela: &str, coluna_def: &str) -> Result<(), DbErr> {
    let backend = db.get_database_backend();
    let sql = format!("ALTER TABLE {tabela} ADD COLUMN {coluna_def}");
    if let Err(e) = db.execute(Statement::from_string(backend, sql)).await {
        if !e.to_string().to_lowercase().contains("duplicate column") {
            return Err(e);
        }
    }
    Ok(())
}

pub async fn aplicar(db: &DatabaseConnection) -> Result<(), DbErr> {
    add_coluna(db, "livro", "saldo_publicado INTEGER NOT NULL DEFAULT 0").await?;
    add_coluna(db, "pedido", "estoque_status TEXT NOT NULL DEFAULT 'incorporada'").await?;
    add_coluna(db, "pedido", "estoque_pronta_em TEXT").await?;
    add_coluna(db, "pedido", "estoque_incorporada_em TEXT").await?;
    add_coluna(db, "pedido", "estoque_estornada_em TEXT").await?;
    Ok(())
}
