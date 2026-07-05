//! Implementação SeaORM da porta `PedidoRepo` (ADR-0003).
//! `registrar` grava pedido + itens e baixa o estoque atomicamente (FR-015).

use super::entities::{item_pedido, pedido};
use crate::application::ports::{PedidoRepo, RepoErro};
use crate::domain::estoque::TipoMovimento;
use crate::domain::pedido::Pedido;
use async_trait::async_trait;
use chrono::Local;
use sea_orm::{
    ActiveModelTrait,
    ActiveValue::{NotSet, Set},
    ColumnTrait, ConnectionTrait, DatabaseConnection, DatabaseTransaction, DbErr, EntityTrait,
    QueryFilter, Statement, TransactionTrait,
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

        super::pedido_sql::inserir_cabecalho_e_itens(&txn, pedido).await.map_err(erro)?;

        let criado_em = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        for it in &pedido.itens {
            // Baixa real = min(estoque, qtd) — estoque nunca negativo (FR-003). O movimento
            // `saida_venda` reflete a baixa efetivamente aplicada (invariante SC-001).
            let estoque_atual: i64 = txn
                .query_one(Statement::from_sql_and_values(
                    backend,
                    "SELECT estoque FROM livro WHERE codigo = ?",
                    [it.codigo.clone().into()],
                ))
                .await
                .map_err(erro)?
                .and_then(|r| r.try_get::<i64>("", "estoque").ok())
                .unwrap_or(0);
            let baixa = it.qtd.min(estoque_atual).max(0);
            if baixa > 0 {
                // Consome carimbos ANTES da baixa física (livre = estoque − Σ carimbos)
                // e grava as alocações do item na MESMA transação (FR-008/FR-009).
                let livro_id = super::destinacao_sql::livro_id_por_codigo(&txn, &it.codigo)
                    .await
                    .map_err(erro)?;
                let alocacoes = super::destinacao_sql::consumir_carimbos(
                    &txn,
                    livro_id,
                    baixa,
                    super::destinacao_sql::ModoConsumo::Venda,
                )
                .await
                .map_err(erro)?;
                let item_id: i64 = txn
                    .query_one(Statement::from_sql_and_values(
                        backend,
                        "SELECT id FROM item_pedido WHERE pedido_numero = ? AND codigo = ?",
                        [pedido.numero.into(), it.codigo.clone().into()],
                    ))
                    .await
                    .map_err(erro)?
                    .and_then(|r| r.try_get::<i64>("", "id").ok())
                    .ok_or_else(|| RepoErro::Persistencia("item do pedido não encontrado".into()))?;
                super::destinacao_sql::gravar_alocacoes(
                    &txn,
                    pedido.numero,
                    item_id,
                    it.preco.centavos(),
                    &alocacoes,
                )
                .await
                .map_err(erro)?;
                txn.execute(Statement::from_sql_and_values(
                    backend,
                    "INSERT INTO movimento_estoque
                        (livro_id, tipo, qtd, custo_unit_centavos, fornecedor, motivo, referencia, criado_em)
                     VALUES ((SELECT id FROM livro WHERE codigo = ?), ?, ?, NULL, NULL, NULL, ?, ?)",
                    [
                        it.codigo.clone().into(),
                        TipoMovimento::SaidaVenda.as_str().into(),
                        (-baixa).into(),
                        pedido.numero.to_string().into(),
                        criado_em.clone().into(),
                    ],
                ))
                .await
                .map_err(erro)?;
                txn.execute(Statement::from_sql_and_values(
                    backend,
                    "UPDATE livro SET estoque = estoque - ? WHERE codigo = ?",
                    [baixa.into(), it.codigo.clone().into()],
                ))
                .await
                .map_err(erro)?;
            }
        }

        txn.commit().await.map_err(erro)?;
        Ok(())
    }

    async fn dados_cancelamento(&self, numero: i64) -> Result<Option<(String, bool)>, RepoErro> {
        let row = self
            .db
            .query_one(Statement::from_sql_and_values(
                self.db.get_database_backend(),
                "SELECT data, cancelado FROM pedido WHERE numero = ?",
                [numero.into()],
            ))
            .await
            .map_err(erro)?;
        Ok(row.and_then(|r| {
            let data: String = r.try_get("", "data").ok()?;
            let cancelado: i64 = r.try_get("", "cancelado").ok()?;
            Some((data, cancelado != 0))
        }))
    }

    async fn importar(&self, pedido: &Pedido) -> Result<bool, RepoErro> {
        // Idempotente: pula se o número já existe (FR-069).
        let existe = pedido::Entity::find_by_id(pedido.numero)
            .one(&self.db)
            .await
            .map_err(erro)?;
        if existe.is_some() {
            return Ok(false);
        }
        let txn = self.db.begin().await.map_err(erro)?;
        super::pedido_sql::inserir_cabecalho_e_itens(&txn, pedido).await.map_err(erro)?;
        txn.commit().await.map_err(erro)?;
        Ok(true)
    }

    async fn excluir_item(&self, item_id: i64) -> Result<(), RepoErro> {
        let txn = self.db.begin().await.map_err(erro)?;
        let item = item_pedido::Entity::find_by_id(item_id)
            .one(&txn)
            .await
            .map_err(erro)?;
        if let Some(it) = item {
            let numero = it.pedido_numero;
            // Devolve os carimbos e remove as alocações do item (correção de dados).
            super::destinacao_sql::devolver_alocacoes_item(&txn, item_id)
                .await
                .map_err(erro)?;
            // Devolve ao estoque o que este item baixou (estorno), pelo livro do item.
            let livro = txn
                .query_one(Statement::from_sql_and_values(
                    txn.get_database_backend(),
                    "SELECT id FROM livro WHERE codigo = ?",
                    [it.codigo.clone().into()],
                ))
                .await
                .map_err(erro)?;
            if let Some(l) = livro {
                let livro_id: i64 = l.try_get("", "id").map_err(erro)?;
                super::pedido_sql::estornar_saidas(&txn, numero, Some(livro_id))
                    .await
                    .map_err(erro)?;
            }
            item_pedido::Entity::delete_by_id(item_id)
                .exec(&txn)
                .await
                .map_err(erro)?;
            // Recalcula o total do pedido pela soma dos itens restantes.
            let restantes = item_pedido::Entity::find()
                .filter(item_pedido::Column::PedidoNumero.eq(numero))
                .all(&txn)
                .await
                .map_err(erro)?;
            let total: i64 = restantes.iter().map(|i| i.preco_centavos * i.qtd).sum();
            let mut am: pedido::ActiveModel = pedido::Entity::find_by_id(numero)
                .one(&txn)
                .await
                .map_err(erro)?
                .ok_or_else(|| RepoErro::Persistencia("pedido não encontrado".into()))?
                .into();
            am.total_centavos = Set(total);
            am.update(&txn).await.map_err(erro)?;
        }
        txn.commit().await.map_err(erro)?;
        Ok(())
    }

    /// Cancela a venda (soft delete): devolve o estoque (estorno) e os carimbos
    /// (pelas alocações — FR-010/FR-013) e marca o pedido como `cancelado` —
    /// preserva o registro para auditoria/relatórios. Idempotente.
    async fn excluir_pedido(&self, numero: i64) -> Result<(), RepoErro> {
        let txn = self.db.begin().await.map_err(erro)?;
        // Idempotência dos carimbos: se já cancelado, não devolve de novo.
        let ja_cancelado: i64 = txn
            .query_one(Statement::from_sql_and_values(
                txn.get_database_backend(),
                "SELECT cancelado FROM pedido WHERE numero = ?",
                [numero.into()],
            ))
            .await
            .map_err(erro)?
            .and_then(|r| r.try_get::<i64>("", "cancelado").ok())
            .unwrap_or(0);
        if ja_cancelado == 0 {
            super::destinacao_sql::devolver_alocacoes_pedido(&txn, numero)
                .await
                .map_err(erro)?;
        }
        // Devolve ao estoque o que a venda baixou (estorno no ledger).
        super::pedido_sql::estornar_saidas(&txn, numero, None).await.map_err(erro)?;
        txn.execute(Statement::from_sql_and_values(
            txn.get_database_backend(),
            "UPDATE pedido SET cancelado = 1, cancelado_em = ? WHERE numero = ? AND cancelado = 0",
            [
                Local::now().format("%Y-%m-%dT%H:%M:%S").to_string().into(),
                numero.into(),
            ],
        ))
        .await
        .map_err(erro)?;
        txn.commit().await.map_err(erro)?;
        Ok(())
    }
}
