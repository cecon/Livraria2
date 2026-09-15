use super::api_replica::erro;
use crate::application::api_sync::{validar_pagina, PaginaApi};
use crate::application::ports::RepoErro;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement, TransactionTrait, Value};

pub async fn aplicar(db: &DatabaseConnection, page: &PaginaApi) -> Result<(), RepoErro> {
    let tx = db.begin().await.map_err(erro)?;
    let backend = tx.get_database_backend();
    let row = tx.query_one(Statement::from_string(backend,
        "SELECT last_cursor FROM sync_cursor WHERE recurso='api_catalogo_v1'".to_string())).await.map_err(erro)?;
    let start = row.and_then(|r| r.try_get::<String>("", "last_cursor").ok()).unwrap_or_else(|| "0".into());
    validar_pagina(page, &start)?;
    let now = chrono::Utc::now().to_rfc3339();
    for event in &page.alteracoes {
        if event.operacao == "delete" {
            tx.execute(Statement::from_sql_and_values(backend,
                "UPDATE livro SET ativo=0,excluido_em=?,sincronizado_em=? WHERE sync_uid=?",
                [now.clone().into(), now.clone().into(), event.produto_uid.clone().into()])).await.map_err(erro)?;
            continue;
        }
        let p = event.produto.as_ref().ok_or_else(|| erro("produto ausente"))?;
        // Cloud UUID owns the code; quarantine stale local aliases without deleting
        // row identities, foreign keys, movements or historical sale snapshots.
        tx.execute(Statement::from_sql_and_values(backend,
            "UPDATE livro SET codigo='LOCAL-CONFLITO-'||id||'-'||?,ativo=0,excluido_em=?
             WHERE codigo=? AND (sync_uid IS NULL OR sync_uid<>?)",
            [uuid::Uuid::new_v4().to_string().into(), now.clone().into(), p.codigo.clone().into(),
                event.produto_uid.clone().into()])).await.map_err(erro)?;
        let vals: Vec<Value> = vec![
            event.produto_uid.clone().into(), p.codigo.clone().into(), p.titulo.clone().into(),
            p.autor.clone().into(), p.preco_centavos.into(), p.categoria.into(),
            p.descricao.clone().into(), p.busca_norm.clone().into(), p.saldo_publicado.into(),
            now.clone().into(), now.clone().into(),
        ];
        tx.execute(Statement::from_sql_and_values(backend,
            "INSERT INTO livro(sync_uid,codigo,titulo,autor,preco_centavos,categoria,descricao,busca_norm,
              saldo_publicado,ativo,origem,atualizado_em,sincronizado_em,estoque,custo_medio_centavos)
             VALUES(?,?,?,?,?,?,?,?,?,1,'escritorio',?,?,0,0)
             ON CONFLICT(sync_uid) DO UPDATE SET codigo=excluded.codigo,titulo=excluded.titulo,
              autor=excluded.autor,preco_centavos=excluded.preco_centavos,categoria=excluded.categoria,
              descricao=excluded.descricao,busca_norm=excluded.busca_norm,saldo_publicado=excluded.saldo_publicado,
              ativo=1,origem='escritorio',atualizado_em=excluded.atualizado_em,
              sincronizado_em=excluded.sincronizado_em,excluido_em=NULL", vals)).await.map_err(erro)?;
        tx.execute(Statement::from_sql_and_values(backend,
            "UPDATE livro SET estoque=max(0,saldo_publicado-coalesce((
              SELECT sum(i.qtd) FROM item_pedido i JOIN pedido p ON p.numero=i.pedido_numero
              WHERE i.livro_uid=livro.sync_uid AND p.sincronizado_em IS NULL AND p.cancelado=0
            ),0)) WHERE sync_uid=?", [event.produto_uid.clone().into()])).await.map_err(erro)?;
    }
    tx.execute(Statement::from_sql_and_values(backend,
        "INSERT INTO sync_cursor(recurso,last_cursor) VALUES('api_catalogo_v1',?)
         ON CONFLICT(recurso) DO UPDATE SET last_cursor=excluded.last_cursor",
        [page.proximo_cursor.clone().into()])).await.map_err(erro)?;
    tx.commit().await.map_err(erro)
}
