use crate::application::ports::RepoErro;
use reqwest::RequestBuilder;
use serde_json::{json, Value};
use std::{fs, io::Write, path::PathBuf, sync::Mutex, time::Instant};

static LOG_LOCK: Mutex<()> = Mutex::new(());
pub struct Diagnostico {
    pub origem: String,
    pub pdv_uid: String,
    pub arquivo: Option<PathBuf>,
}

fn motivo(body: &Value) -> &str {
    match body.get("message").and_then(Value::as_str).unwrap_or("") {
        value @ ("Cursor nao confirmado" | "Cursor nao entregue" | "Dispositivo indisponivel"
        | "Turno ja recebido com outros dados" | "Usuario do turno indisponivel na nuvem"
        | "Ja existe turno aberto nesta maquina" | "Fechamento divergente"
        | "Movimento ja recebido com outros dados" | "Turno ou usuario nao pertencem a esta maquina"
        | "Pedido ja recebido com outra identidade ou conteudo" | "Pedido legado exige reconciliacao antes da migracao"
        | "Venda do PDV exige turno e operador" | "Turno ou operador nao pertencem a esta maquina"
        | "Venda pertence a outro PDV" | "Identidade duplicada ou cadastro dependente ainda indisponivel") => value,
        _ => "A API recusou a operacao",
    }
}

fn cursores(body: &Value) -> String {
    ["solicitado", "aplicado", "entregue"].iter().filter_map(|key| {
        let value = body.get("sync")?.get(*key)?.as_str()?;
        if value.is_empty() || value.len() > 19 || !value.bytes().all(|c| c.is_ascii_digit()) { return None; }
        Some(format!("{key}={value}"))
    }).collect::<Vec<_>>().join(", ")
}

impl Diagnostico {
    pub async fn executar(&self, request: RequestBuilder, etapa: &str) -> Result<Value, RepoErro> {
        let id = uuid::Uuid::new_v4().to_string();
        let start = Instant::now();
        let response = request.header("x-request-id", &id).send().await;
        let mut response = match response {
            Ok(response) => response,
            Err(e) => {
                let reason = if e.is_timeout() { "Tempo de conexao esgotado" }
                    else if e.is_connect() { "Nao foi possivel conectar a API" } else { "Falha de comunicacao" };
                self.registrar(etapa, &id, None, start, reason);
                return Err(self.erro(etapa, &id, reason));
            }
        };
        let id = response.headers().get("x-request-id").and_then(|h| h.to_str().ok())
            .filter(|s| uuid::Uuid::parse_str(s).is_ok()).unwrap_or(&id).to_string();
        let status = response.status();
        if status.is_success() {
            let result = response.json().await;
            let reason = if result.is_ok() { "ok" } else { "Resposta invalida da API" };
            self.registrar(etapa, &id, Some(status.as_u16()), start, reason);
            return result.map_err(|_| self.erro(etapa, &id, reason));
        }
        // A proxy may return HTML or echo sensitive input. Parse bounded JSON and
        // retain only known business messages and numeric catalog cursors.
        let mut bytes = Vec::new();
        while let Ok(Some(chunk)) = response.chunk().await {
            if bytes.len() + chunk.len() > 8192 { bytes.clear(); break; }
            bytes.extend_from_slice(&chunk);
        }
        let body: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        let cursors = cursores(&body);
        let reason = format!("HTTP {}: {}{}", status.as_u16(), motivo(&body),
            if cursors.is_empty() { String::new() } else { format!(" ({cursors})") });
        self.registrar(etapa, &id, Some(status.as_u16()), start, &reason);
        Err(self.erro(etapa, &id, &reason))
    }

    fn erro(&self, etapa: &str, id: &str, reason: &str) -> RepoErro {
        RepoErro::Persistencia(format!("{etapa}: {reason}. Referencia: {id}. Dados mantidos para reenvio."))
    }

    fn registrar(&self, etapa: &str, id: &str, status: Option<u16>, start: Instant, reason: &str) {
        let line = json!({"timestamp":chrono::Utc::now().to_rfc3339(),"event":"sync_http",
            "requestId":id,"etapa":etapa,"api":self.origem,"pdvUid":self.pdv_uid,
            "version":env!("CARGO_PKG_VERSION"),"status":status,
            "durationMs":start.elapsed().as_millis(),"reason":reason}).to_string();
        eprintln!("{line}");
        if let Some(path) = &self.arquivo {
            if let Err(error) = append_log(path, &line) {
                eprintln!("sync_diagnostic_log_unavailable: {:?}", error.kind());
            }
        }
    }
}

fn append_log(path: &std::path::Path, line: &str) -> std::io::Result<()> {
    let _lock = LOG_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(parent) = path.parent() { fs::create_dir_all(parent)?; }
    if fs::metadata(path).map(|m| m.len() >= 1_048_576).unwrap_or(false) {
        let previous = path.with_extension("log.1");
        if previous.exists() { fs::remove_file(&previous)?; }
        fs::rename(path, previous)?;
    }
    writeln!(fs::OpenOptions::new().create(true).append(true).open(path)?, "{line}")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn erro_http_real_mostra_etapa_motivo_e_referencia_e_grava_log_seguro() {
        use std::io::Read;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let remote_id = id.clone();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream.set_read_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
            let mut request = [0u8; 4096];
            stream.read(&mut request).unwrap();
            let body = json!({"message":"Cursor nao entregue", "senha":"segredo-corpo",
                "sync":{"solicitado":"734","aplicado":"775","entregue":"775"}}).to_string();
            write!(stream, "HTTP/1.1 409 Conflict\r\nx-request-id: {remote_id}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
        });
        let folder = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let path = folder.join("sync.log");
        let diag = Diagnostico { origem: format!("http://{address}"),
            pdv_uid: uuid::Uuid::new_v4().to_string(), arquivo: Some(path.clone()) };
        let request = reqwest::Client::new().get(format!("http://{address}/?senha=segredo-query"))
            .bearer_auth("segredo-token");
        let error = diag.executar(request, "Confirmar catalogo").await.unwrap_err().to_string();
        server.join().unwrap();
        assert!(error.contains("Confirmar catalogo: HTTP 409: Cursor nao entregue"));
        assert!(error.contains("solicitado=734, aplicado=775, entregue=775"));
        assert!(error.contains(&id));
        let log = fs::read_to_string(path).unwrap();
        assert!(log.contains(&id));
        assert!(!log.contains("segredo"));
        fs::remove_dir_all(folder).unwrap();
    }
    #[test]
    fn nao_expoe_corpos_arbitrarios_e_campos_sensiveis() {
        assert_eq!(motivo(&json!({"message":"senha=segredo token=abc"})), "A API recusou a operacao");
        let body = json!({"message":"Cursor nao entregue","sync":{
            "solicitado":"734","aplicado":"775","entregue":"token-secreto","senha":"segredo"}});
        assert_eq!(motivo(&body), "Cursor nao entregue");
        assert_eq!(cursores(&body), "solicitado=734, aplicado=775");
    }
    #[test]
    fn rotaciona_log_sem_crescimento_ilimitado() {
        let folder = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        fs::create_dir_all(&folder).unwrap();
        let path = folder.join("sync.log");
        fs::write(&path, vec![b'x'; 1_048_576]).unwrap();
        append_log(&path, "novo").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap().trim(), "novo");
        assert_eq!(fs::metadata(path.with_extension("log.1")).unwrap().len(), 1_048_576);
        fs::remove_dir_all(folder).unwrap();
    }
}
