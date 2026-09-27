use crate::{adapters::nuvem::api_sync::ApiSync, commands::{AppState, ErroDto}};
use crate::adapters::nuvem::produtos::{erro, rede};
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};
use base64::{engine::general_purpose::STANDARD, Engine};
use std::path::Path;

static DOWNLOAD: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
static PREVIEW: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(4);

async fn cached(db: &DatabaseConnection, uid: &str) -> Result<Option<String>, ErroDto> {
    let row = db.query_one(Statement::from_sql_and_values(db.get_database_backend(),
        "SELECT imagem FROM capa_cache WHERE uid=?", [uid.into()])).await.map_err(rede)?;
    Ok(row.and_then(|r| r.try_get("", "imagem").ok()))
}
async fn download(db: &DatabaseConnection, api: &ApiSync, uid: &str) -> Result<String, ErroDto> {
    db.execute(Statement::from_sql_and_values(db.get_database_backend(),
        "INSERT INTO capa_tentativa(uid,tentada_em) VALUES(?,?) ON CONFLICT(uid) DO UPDATE SET tentada_em=excluded.tentada_em",
        [uid.into(), chrono::Utc::now().to_rfc3339().into()])).await.map_err(rede)?;
    let bytes = api.baixar_capa(uid).await.map_err(rede)?;
    let image = format!("data:image/webp;base64,{}", STANDARD.encode(bytes));
    db.execute(Statement::from_sql_and_values(db.get_database_backend(),
        "INSERT OR IGNORE INTO capa_cache(uid,imagem) VALUES(?,?)", [uid.into(), image.clone().into()]))
        .await.map_err(rede)?;
    Ok(image)
}

#[tauri::command]
pub async fn imagem_produto(state: tauri::State<'_, AppState>, codigo: Option<String>, uid: Option<String>)
    -> Result<Option<String>, ErroDto> {
    let id = if let Some(uid) = uid { Some(uid) } else if let Some(code) = codigo {
        state.db.query_one(Statement::from_sql_and_values(state.db.get_database_backend(),
            "SELECT c.capa_uid FROM produto_capa c JOIN livro l ON l.sync_uid=c.produto_uid WHERE l.codigo=?",
            [code.into()])).await.map_err(rede)?.and_then(|r| r.try_get::<Option<String>>("", "capa_uid").ok().flatten())
    } else { None };
    let Some(uid) = id else { return Ok(None); };
    uuid::Uuid::parse_str(&uid).map_err(rede)?;
    if let Some(image) = cached(&state.db, &uid).await? { return Ok(Some(image)); }
    // Listagens extensas não abrem uma conexão por capa simultaneamente.
    let Ok(_permit) = PREVIEW.try_acquire() else { return Ok(None); };
    let api = ApiSync::conectar_com_config(state.machine_config_path.as_deref()).await.map_err(rede)?;
    download(&state.db, &api, &uid).await.map(Some)
}

#[tauri::command]
pub async fn imagem_enviar(state: tauri::State<'_, AppState>, imagem: String) -> Result<String, ErroDto> {
    if imagem.len() > 7_000_000 { return Err(erro("IMAGEM_INVALIDA", "Imagem muito grande. Limite: 5 MB.")); }
    let api = ApiSync::conectar_com_config(state.machine_config_path.as_deref()).await.map_err(rede)?;
    let response = api.enviar_capa(&imagem).await.map_err(rede)?;
    if !response.status().is_success() {
        let message = response.json::<serde_json::Value>().await.ok()
            .and_then(|v| v["message"].as_str().map(String::from))
            .unwrap_or_else(|| "Não foi possível enviar a imagem. Confira a conexão e o arquivo.".into());
        return Err(erro("IMAGEM_INVALIDA", &message));
    }
    let value: serde_json::Value = response.json().await.map_err(rede)?;
    let uid = value["uid"].as_str().ok_or_else(|| rede("uid"))?;
    uuid::Uuid::parse_str(uid).map_err(rede)?;
    // A gravação do produto continua independente de conseguir baixar a prévia.
    let _ = download(&state.db, &api, uid).await;
    Ok(uid.into())
}

pub fn aquecer(db: DatabaseConnection, config: Option<std::path::PathBuf>) {
    tokio::spawn(async move {
        let Ok(_lock) = DOWNLOAD.try_lock() else { return; };
        if let Err(e) = warm(&db, config.as_deref()).await {
            eprintln!("Cache de imagens pendente: {}", e.mensagem);
        }
    });
}
async fn warm(db: &DatabaseConnection, config: Option<&Path>) -> Result<(), ErroDto> {
    let api = ApiSync::conectar_com_config(config).await.map_err(rede)?;
    crate::image_bootstrap::run(db, &api).await?;
    let rows = db.query_all(Statement::from_string(db.get_database_backend(),
        "SELECT DISTINCT c.capa_uid,t.tentada_em FROM produto_capa c LEFT JOIN capa_cache i ON i.uid=c.capa_uid
         LEFT JOIN capa_tentativa t ON t.uid=c.capa_uid
         WHERE c.capa_uid IS NOT NULL AND i.uid IS NULL ORDER BY coalesce(t.tentada_em,'') LIMIT 100")).await.map_err(rede)?;
    if rows.is_empty() { return Ok(()); }
    let start = std::time::Instant::now();
    for row in rows {
        if start.elapsed().as_secs() >= 30 { break; }
        let uid: String = row.try_get("", "capa_uid").map_err(rede)?;
        if download(db, &api, &uid).await.is_err() {
            eprintln!("Imagem {} pendente; nova tentativa na próxima sincronização", uid);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};

    #[tokio::test]
    async fn download_falho_reenvia_e_cache_sobrevive_sem_servidor() {
        let folder = tempfile::tempdir().unwrap();
        let url = format!("sqlite://{}?mode=rwc", folder.path().join("images.db").display());
        let db = sea_orm::Database::connect(&url).await.unwrap();
        crate::migration::m019::aplicar(&db).await.unwrap();
        let server = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", server.local_addr().unwrap());
        let thread = std::thread::spawn(move || {
            for status in [500, 200] {
                let (mut stream, _) = server.accept().unwrap();
                let mut request = [0;4096]; let _ = stream.read(&mut request);
                let bytes = b"RIFFxxxxWEBPtest";
                write!(stream,"HTTP/1.1 {status} OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",bytes.len()).unwrap();
                stream.write_all(bytes).unwrap();
            }
        });
        let api = ApiSync::teste(base);
        let uid = uuid::Uuid::new_v4().to_string();
        assert!(download(&db, &api, &uid).await.is_err());
        assert!(cached(&db, &uid).await.unwrap().is_none());
        let image = download(&db, &api, &uid).await.unwrap();
        thread.join().unwrap();
        db.close().await.unwrap();
        let reopened = sea_orm::Database::connect(&url).await.unwrap();
        assert_eq!(cached(&reopened, &uid).await.unwrap(), Some(image));
    }
}
