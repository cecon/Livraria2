//! Helpers SQL do pedido (cabeçalho/itens e estorno de saídas), extraídos de
//! `pedido_repo` para manter cada arquivo sob 300 linhas (Princípio III).

use super::entities::{item_pedido, pedido};
use crate::domain::estoque::TipoMovimento;
use crate::domain::pedido::Pedido;
use chrono::Local;
use sea_orm::{
    ActiveValue::{NotSet, Set},
    ConnectionTrait, DatabaseTransaction, DbErr, EntityTrait, Statement,
};

/// Estorna (devolve ao estoque) o que ainda está baixado de uma venda. Para cada
/// livro com saldo de saída pendente no `referencia` do pedido (Σ de `saida_venda`
/// + `estorno` < 0), gera um movimento `estorno` (+qtd) e soma o estoque de volta.
/// `apenas_livro` limita a um único livro (ao excluir um item). Idempotente: se o
/// net já é 0 (nada baixado/já estornado), não faz nada — evita estorno duplicado.
pub(crate) async fn estornar_saidas(
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

/// Insere o cabeçalho do pedido, seus itens e os recebimentos por forma na
/// transação (sem mexer no estoque). Pagamentos vão para `pagamento_pedido`.
pub(crate) async fn inserir_cabecalho_e_itens(
    txn: &DatabaseTransaction,
    pedido: &Pedido,
) -> Result<(), DbErr> {
    let pm = pedido::ActiveModel {
        numero: Set(pedido.numero),
        cliente: Set(pedido.cliente.clone()),
        turno: Set(pedido.turno.chave().to_string()),
        data: Set(pedido.data.clone()),
        total_centavos: Set(pedido.total().centavos()),
        cancelado: Set(false),
        cancelado_em: Set(None),
    };
    pedido::Entity::insert(pm).exec(txn).await?;
    super::pagamento_pedido_sql::inserir(txn, pedido.numero, &pedido.pagamentos).await?;

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
