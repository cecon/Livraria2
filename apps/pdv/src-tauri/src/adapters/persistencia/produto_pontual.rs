use crate::adapters::nuvem::produtos::Produto;
use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement, TransactionTrait, Value};

// Importação por UID não confirma nem avança o cursor global de catálogo.
pub async fn importar(db: &DatabaseConnection, p: &Produto) -> Result<(), DbErr> {
    let tx = db.begin().await?;
    let backend = tx.get_database_backend();
    let version = p.versao.parse::<u64>().map_err(|_| DbErr::Custom("Versão inválida".into()))?;
    let previous = tx.query_one(Statement::from_sql_and_values(backend,
        "SELECT versao FROM produto_importacao_pontual WHERE uid=?", [p.uid.clone().into()])).await?;
    if previous.and_then(|r| r.try_get::<String>("", "versao").ok())
        .and_then(|v| v.parse::<u64>().ok()).is_some_and(|v| v > version) { return Ok(()); }
    let conflicting = tx.query_one(Statement::from_sql_and_values(backend,
        "SELECT 1 FROM livro WHERE codigo=? AND (sync_uid IS NULL OR sync_uid<>?)",
        [p.codigo.clone().into(), p.uid.clone().into()])).await?;
    if conflicting.is_some() { return Err(DbErr::Custom("Conflito de identidade local".into())); }
    let now = chrono::Utc::now().to_rfc3339();
    let search = crate::domain::texto::normalize(&format!("{} {} {}", p.codigo, p.titulo, p.autor.as_deref().unwrap_or("")));
    let values: Vec<Value> = vec![p.uid.clone().into(), p.codigo.clone().into(), p.titulo.clone().into(),
        p.autor.clone().into(), p.preco_centavos.into(), p.categoria.into(), p.descricao.clone().into(),
        search.into(), p.saldo_publicado.into(), p.ativo.into(), now.clone().into(), now.into()];
    tx.execute(Statement::from_sql_and_values(backend,
        "INSERT INTO livro(sync_uid,codigo,titulo,autor,preco_centavos,categoria,descricao,busca_norm,
         saldo_publicado,ativo,origem,atualizado_em,sincronizado_em,estoque,custo_medio_centavos)
         VALUES(?,?,?,?,?,?,?,?,?,?,'escritorio',?,?,0,0)
         ON CONFLICT(sync_uid) DO UPDATE SET codigo=excluded.codigo,titulo=excluded.titulo,
         autor=excluded.autor,preco_centavos=excluded.preco_centavos,categoria=excluded.categoria,
         descricao=excluded.descricao,busca_norm=excluded.busca_norm,saldo_publicado=excluded.saldo_publicado,
         ativo=excluded.ativo,atualizado_em=excluded.atualizado_em,sincronizado_em=excluded.sincronizado_em,
         excluido_em=NULL", values)).await?;
    tx.execute(Statement::from_sql_and_values(backend,
        "INSERT INTO produto_importacao_pontual(uid,versao) VALUES(?,?) ON CONFLICT(uid) DO UPDATE SET versao=excluded.versao",
        [p.uid.clone().into(), p.versao.clone().into()])).await?;
    tx.execute(Statement::from_sql_and_values(backend,
        "UPDATE livro SET estoque=max(0,saldo_publicado-coalesce((
          SELECT sum(i.qtd) FROM item_pedido i JOIN pedido p ON p.numero=i.pedido_numero
          WHERE i.livro_uid=livro.sync_uid AND p.sincronizado_em IS NULL AND p.cancelado=0
        ),0)) WHERE sync_uid=?", [p.uid.clone().into()])).await?;
    tx.commit().await
}
