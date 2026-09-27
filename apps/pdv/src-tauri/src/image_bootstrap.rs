use crate::adapters::nuvem::api_sync::ApiSync;
use crate::commands::ErroDto;
use crate::adapters::nuvem::produtos::rede;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement, TransactionTrait};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageRef { pub uid: String, pub capa_uid: Option<String>, pub versao: String }
#[derive(Deserialize)]
pub struct ImagePage { pub items: Vec<ImageRef>, pub next: Option<String> }

pub async fn apply(db: &DatabaseConnection, page: ImagePage) -> Result<(), ErroDto> {
    let tx = db.begin().await.map_err(rede)?;
    for row in page.items {
        uuid::Uuid::parse_str(&row.uid).map_err(rede)?;
        if let Some(id) = &row.capa_uid { uuid::Uuid::parse_str(id).map_err(rede)?; }
        row.versao.parse::<i64>().map_err(rede)?;
        tx.execute(Statement::from_sql_and_values(tx.get_database_backend(),
            "INSERT INTO produto_capa(produto_uid,capa_uid,versao) VALUES(?,?,?) ON CONFLICT(produto_uid)
             DO UPDATE SET capa_uid=excluded.capa_uid,versao=excluded.versao
             WHERE CAST(produto_capa.versao AS INTEGER)<=CAST(excluded.versao AS INTEGER)",
            [row.uid.into(), row.capa_uid.into(), row.versao.into()])).await.map_err(rede)?;
    }
    tx.execute(Statement::from_sql_and_values(tx.get_database_backend(),
        "INSERT INTO sync_cursor(recurso,last_cursor) VALUES('api_imagens_bootstrap',?) ON CONFLICT(recurso) DO UPDATE SET last_cursor=excluded.last_cursor",
        [page.next.unwrap_or_else(|| "done".into()).into()])).await.map_err(rede)?;
    tx.commit().await.map_err(rede)
}

pub async fn run(db: &DatabaseConnection, api: &ApiSync) -> Result<(), ErroDto> {
    let cursor = db.query_one(Statement::from_string(db.get_database_backend(),
        "SELECT last_cursor FROM sync_cursor WHERE recurso='api_imagens_bootstrap'"))
        .await.map_err(rede)?.and_then(|r| r.try_get::<String>("", "last_cursor").ok());
    if cursor.as_deref() == Some("done") { return Ok(()); }
    let mut cursor = cursor;
    // Carga aditiva; não zera o cursor de catálogo nem reenvia vendas.
    for _ in 0..20 {
        let page = api.mapa_capas(cursor.as_deref()).await.map_err(rede)?;
        if let Some(next) = &page.next {
            uuid::Uuid::parse_str(next).map_err(rede)?;
            if cursor.as_ref().is_some_and(|last| next <= last) { return Err(rede("Cursor de imagem inválido")); }
        }
        cursor = page.next.clone();
        apply(db, page).await?;
        if cursor.is_none() { break; }
    }
    Ok(())
}
