//! Implementação SeaORM da porta `PedidoRepo` (ADR-0003).
//! `registrar` grava pedido + itens e baixa o estoque atomicamente (FR-015).

use super::entities::{item_pedido, pedido};
use crate::application::ports::{PedidoRepo, RepoErro};
use crate::domain::pedido::Pedido;
use async_trait::async_trait;
use sea_orm::{
    ActiveValue::{NotSet, Set},
    ConnectionTrait, DatabaseConnection, DbErr, EntityTrait, Statement, TransactionTrait,
};

pub struct SeaPedidoRepo {
    db: DatabaseConnection,
}

impl SeaPedidoRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

fn erro(e: DbErr) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

#[async_trait]
impl PedidoRepo for SeaPedidoRepo {
    async fn proximo_numero(&self) -> Result<i64, RepoErro> {
        let backend = self.db.get_database_backend();
        let row = self
            .db
            .query_one(Statement::from_string(
                backend,
                "SELECT COALESCE(MAX(numero), 0) + 1 AS prox FROM pedido".to_string(),
            ))
            .await
            .map_err(erro)?;
        match row {
            Some(r) => Ok(r.try_get::<i64>("", "prox").map_err(erro)?),
            None => Ok(1),
        }
    }

    async fn registrar(&self, pedido: &Pedido) -> Result<(), RepoErro> {
        let txn = self.db.begin().await.map_err(erro)?;
        let backend = txn.get_database_backend();

        let pag = &pedido.pagamentos;
        let pm = pedido::ActiveModel {
            numero: Set(pedido.numero),
            cliente: Set(pedido.cliente.clone()),
            turno: Set(pedido.turno.chave().to_string()),
            data: Set(pedido.data.clone()),
            total_centavos: Set(pedido.total().centavos()),
            val_cartao: Set(pag.cartao.centavos()),
            val_dinheiro: Set(pag.dinheiro.centavos()),
            val_pix: Set(pag.pix.centavos()),
            val_ministerio: Set(pag.ministerio.centavos()),
            val_vale: Set(pag.vale.centavos()),
        };
        pedido::Entity::insert(pm)
            .exec(&txn)
            .await
            .map_err(erro)?;

        for it in &pedido.itens {
            let im = item_pedido::ActiveModel {
                id: NotSet,
                pedido_numero: Set(pedido.numero),
                codigo: Set(it.codigo.clone()),
                titulo: Set(it.titulo.clone()),
                preco_centavos: Set(it.preco.centavos()),
                qtd: Set(it.qtd),
            };
            item_pedido::Entity::insert(im)
                .exec(&txn)
                .await
                .map_err(erro)?;

            // Baixa de estoque com piso em zero (FR-015), na mesma transação.
            txn.execute(Statement::from_sql_and_values(
                backend,
                "UPDATE livro SET estoque = MAX(0, estoque - ?) WHERE codigo = ?",
                [it.qtd.into(), it.codigo.clone().into()],
            ))
            .await
            .map_err(erro)?;
        }

        txn.commit().await.map_err(erro)?;
        Ok(())
    }
}
