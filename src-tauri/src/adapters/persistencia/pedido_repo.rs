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

/// Estorna (devolve ao estoque) o que ainda está baixado de uma venda. Para cada
/// livro com saldo de saída pendente no `referencia` do pedido (Σ de `saida_venda`
/// + `estorno` < 0), gera um movimento `estorno` (+qtd) e soma o estoque de volta.
/// `apenas_livro` limita a um único livro (ao excluir um item). Idempotente: se o
/// net já é 0 (nada baixado/já estornado), não faz nada — evita estorno duplicado.
async fn estornar_saidas(
    txn: &DatabaseTransaction,
    numero: i64,
    apenas_livro: Option<i64>,
) -> Result<(), DbErr> {
    let mut sql = String::from(
        "SELECT livro_id, SUM(qtd) AS net FROM movimento_estoque
         WHERE referencia = ? AND tipo IN ('saida_venda','estorno')",
    );
    let mut vals: Vec<sea_orm::Value> = vec![numero.to_string().into()];
    if let Some(id) = apenas_livro {
        sql.push_str(" AND livro_id = ?");
        vals.push(id.into());
    }
    sql.push_str(" GROUP BY livro_id HAVING net < 0");
    let rows = txn
        .query_all(Statement::from_sql_and_values(
            txn.get_database_backend(),
            &sql,
            vals,
        ))
        .await?;
    let criado_em = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let motivo = format!("exclusão da venda #{numero}");
    for r in &rows {
        let livro_id: i64 = r.try_get("", "livro_id")?;
        let net: i64 = r.try_get("", "net")?; // negativo (ainda baixado)
        let reverter = -net; // positivo
        txn.execute(Statement::from_sql_and_values(
            txn.get_database_backend(),
            "INSERT INTO movimento_estoque
                (livro_id, tipo, qtd, custo_unit_centavos, fornecedor, motivo, referencia, criado_em)
             VALUES (?, ?, ?, NULL, NULL, ?, ?, ?)",
            [
                livro_id.into(),
                TipoMovimento::Estorno.as_str().into(),
                reverter.into(),
                motivo.clone().into(),
                numero.to_string().into(),
                criado_em.clone().into(),
            ],
        ))
        .await?;
        txn.execute(Statement::from_sql_and_values(
            txn.get_database_backend(),
            "UPDATE livro SET estoque = estoque + ? WHERE id = ?",
            [reverter.into(), livro_id.into()],
        ))
        .await?;
    }
    Ok(())
}

/// Insere o cabeçalho do pedido e seus itens na transação (sem mexer no estoque).
async fn inserir_cabecalho_e_itens(
    txn: &DatabaseTransaction,
    pedido: &Pedido,
) -> Result<(), DbErr> {
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
        cancelado: Set(false),
        cancelado_em: Set(None),
    };
    pedido::Entity::insert(pm).exec(txn).await?;

    for it in &pedido.itens {
        let im = item_pedido::ActiveModel {
            id: NotSet,
            pedido_numero: Set(pedido.numero),
            codigo: Set(it.codigo.clone()),
            titulo: Set(it.titulo.clone()),
            preco_centavos: Set(it.preco.centavos()),
            qtd: Set(it.qtd),
        };
        item_pedido::Entity::insert(im).exec(txn).await?;
    }
    Ok(())
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

        inserir_cabecalho_e_itens(&txn, pedido).await.map_err(erro)?;

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
        inserir_cabecalho_e_itens(&txn, pedido).await.map_err(erro)?;
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
                estornar_saidas(&txn, numero, Some(livro_id))
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

    /// Cancela a venda (soft delete): devolve o estoque (estorno) e marca o pedido
    /// como `cancelado` — preserva o registro para auditoria/relatórios. Idempotente.
    async fn excluir_pedido(&self, numero: i64) -> Result<(), RepoErro> {
        let txn = self.db.begin().await.map_err(erro)?;
        // Devolve ao estoque o que a venda baixou (estorno no ledger).
        estornar_saidas(&txn, numero, None).await.map_err(erro)?;
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
