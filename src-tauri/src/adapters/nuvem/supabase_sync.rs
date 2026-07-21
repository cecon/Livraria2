//! Adapter Supabase — `NuvemRepo` via PostgREST/HTTPS (reqwest). ADR-0015/0016.
//!
//! Upsert por `sync_uid` (`Prefer: resolution=merge-duplicates`), pull por cursor
//! (`sincronizado_em > cursor`, ordem do servidor), `agora_servidor` pelo header
//! `Date`. Auth por **token de usuário** (Bearer) + `apikey` — NUNCA `service_role`.

use crate::application::ports::RepoErro;
use crate::application::ports_sync::{LotePull, NuvemRepo, RegistroSync};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::Value;
use std::path::Path;

const LIMITE_PULL: usize = 500;

/// Configuração de acesso à nuvem. Segredos fora do repo (ADR-0015): vêm de env
/// (dev) OU de um arquivo `sync.json` na pasta de config do app (desktop instalado).
#[derive(Debug, Clone, Deserialize)]
pub struct ConfigSync {
    pub url: String,
    pub anon: String,
    pub email: String,
    pub senha: String,
}

impl ConfigSync {
    /// Env vars têm prioridade; se incompletas, lê o `arquivo` JSON (se informado).
    pub fn carregar(arquivo: Option<&Path>) -> Result<Self, RepoErro> {
        if let (Ok(url), Ok(anon), Ok(email), Ok(senha)) = (
            std::env::var("SUPABASE_URL"),
            std::env::var("SUPABASE_ANON_KEY"),
            std::env::var("SUPABASE_PDV_EMAIL"),
            std::env::var("SUPABASE_PDV_SENHA"),
        ) {
            return Ok(Self { url, anon, email, senha });
        }
        let path = arquivo.ok_or_else(|| RepoErro::Persistencia("config de sync ausente (env ou sync.json)".into()))?;
        let txt = std::fs::read_to_string(path).map_err(erro)?;
        serde_json::from_str(&txt).map_err(erro)
    }
}

pub struct SupabaseSync {
    client: reqwest::Client,
    rest_url: String,
    apikey: String,
    token: String,
}

impl SupabaseSync {
    pub fn new(base_url: &str, apikey: String, token: String) -> Self {
        let rest_url = format!("{}/rest/v1", base_url.trim_end_matches('/'));
        Self { client: reqwest::Client::new(), rest_url, apikey, token }
    }

    /// Login por email/senha (Supabase Auth, password grant) → JWT de usuário.
    pub async fn login(base_url: &str, apikey: &str, email: &str, senha: &str) -> Result<String, RepoErro> {
        let url = format!("{}/auth/v1/token?grant_type=password", base_url.trim_end_matches('/'));
        let resp = reqwest::Client::new()
            .post(&url)
            .header("apikey", apikey)
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({"email": email, "password": senha}))
            .send()
            .await
            .map_err(erro)?;
        if !resp.status().is_success() {
            let s = resp.status();
            let t = resp.text().await.unwrap_or_default();
            return Err(RepoErro::Persistencia(format!("login {s}: {t}")));
        }
        let v: serde_json::Value = resp.json().await.map_err(erro)?;
        v.get("access_token")
            .and_then(|x| x.as_str())
            .map(str::to_string)
            .ok_or_else(|| RepoErro::Persistencia("login sem access_token".into()))
    }

    /// Conecta a partir de uma [`ConfigSync`] (autentica o usuário de serviço do PDV).
    pub async fn conectar_de(cfg: &ConfigSync) -> Result<Self, RepoErro> {
        let token = Self::login(&cfg.url, &cfg.anon, &cfg.email, &cfg.senha).await?;
        Ok(Self::new(&cfg.url, cfg.anon.clone(), token))
    }

    /// Conecta lendo env vars OU o `arquivo` de config (sync.json). Segredos fora
    /// do repo (ADR-0015).
    pub async fn conectar(arquivo: Option<&Path>) -> Result<Self, RepoErro> {
        Self::conectar_de(&ConfigSync::carregar(arquivo)?).await
    }

    fn req(&self, method: reqwest::Method, url: &str) -> reqwest::RequestBuilder {
        self.client
            .request(method, url)
            .header("apikey", &self.apikey)
            .header("Authorization", format!("Bearer {}", self.token))
    }
}

fn erro(e: impl std::fmt::Display) -> RepoErro {
    RepoErro::Persistencia(e.to_string())
}

/// URL de pull: registros com `sincronizado_em > cursor`, ordenados, limitados.
fn url_pull(rest_url: &str, recurso: &str, cursor: &str) -> String {
    let c = if cursor.is_empty() { "1970-01-01T00:00:00Z" } else { cursor };
    let c = encode_query(c);
    format!("{rest_url}/{recurso}?sincronizado_em=gt.{c}&order=sincronizado_em.asc&limit={LIMITE_PULL}")
}

/// Encoding mínimo p/ timestamps em query string (`:` e `+`).
fn encode_query(s: &str) -> String {
    s.replace('+', "%2B").replace(':', "%3A")
}

fn campo_texto(obj: &Value, campo: &str) -> Option<String> {
    obj.get(campo).and_then(|v| v.as_str()).map(str::to_string)
}

fn para_registro(recurso: &str, obj: Value) -> RegistroSync {
    RegistroSync {
        recurso: recurso.to_string(),
        sync_uid: campo_texto(&obj, "sync_uid").unwrap_or_default(),
        atualizado_em: campo_texto(&obj, "atualizado_em"),
        excluido_em: campo_texto(&obj, "excluido_em"),
        dados: obj,
    }
}

#[async_trait]
impl NuvemRepo for SupabaseSync {
    async fn upsert(&self, recurso: &str, registros: &[RegistroSync]) -> Result<(), RepoErro> {
        if registros.is_empty() {
            return Ok(());
        }
        let corpo: Vec<&Value> = registros.iter().map(|r| &r.dados).collect();
        // Resolve conflito pela **chave natural** dos cadastros (chave/codigo/nome_norm/
        // usuario) — o mesmo registro pode ter `sync_uid` diferente entre PDV e nuvem.
        // Eventos (sem chave natural) resolvem por `sync_uid`.
        let conflito = crate::domain::sincronizacao::chave_natural(recurso).unwrap_or("sync_uid");
        let url = format!("{}/{recurso}?on_conflict={conflito}", self.rest_url);
        let resp = self
            .req(reqwest::Method::POST, &url)
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(&corpo)
            .send()
            .await
            .map_err(erro)?;
        if !resp.status().is_success() {
            let s = resp.status();
            let t = resp.text().await.unwrap_or_default();
            return Err(RepoErro::Persistencia(format!("upsert {recurso} {s}: {t}")));
        }
        Ok(())
    }

    async fn buscar_desde(&self, recurso: &str, cursor: &str) -> Result<LotePull, RepoErro> {
        let url = url_pull(&self.rest_url, recurso, cursor);
        let resp = self.req(reqwest::Method::GET, &url).send().await.map_err(erro)?;
        if !resp.status().is_success() {
            let s = resp.status();
            let t = resp.text().await.unwrap_or_default();
            return Err(RepoErro::Persistencia(format!("pull {recurso} {s}: {t}")));
        }
        let arr: Vec<Value> = resp.json().await.map_err(erro)?;
        let mut novo_cursor = cursor.to_string();
        let mut registros = Vec::with_capacity(arr.len());
        for obj in arr {
            if let Some(s) = campo_texto(&obj, "sincronizado_em") {
                novo_cursor = s;
            }
            registros.push(para_registro(recurso, obj));
        }
        Ok(LotePull { registros, novo_cursor })
    }

    async fn agora_servidor(&self) -> Result<String, RepoErro> {
        let url = format!("{}/livro?limit=0", self.rest_url);
        let resp = self.req(reqwest::Method::GET, &url).send().await.map_err(erro)?;
        let data = resp
            .headers()
            .get(reqwest::header::DATE)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| RepoErro::Persistencia("sem header Date".into()))?;
        let dt = chrono::DateTime::parse_from_rfc2822(data).map_err(erro)?;
        Ok(dt.with_timezone(&chrono::Utc).to_rfc3339())
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use serde_json::json;

    #[test]
    fn url_pull_com_cursor_vazio_usa_epoch() {
        let u = url_pull("https://x.supabase.co/rest/v1", "livro", "");
        assert!(u.contains("livro?sincronizado_em=gt.1970-01-01"));
        assert!(u.contains("order=sincronizado_em.asc"));
        assert!(u.contains("limit=500"));
    }

    #[test]
    fn url_pull_encoda_timestamp() {
        let u = url_pull("https://x/rest/v1", "pedido", "2026-07-20T10:00:00+00:00");
        assert!(u.contains("gt.2026-07-20T10%3A00%3A00%2B00%3A00"), "{u}");
    }

    #[test]
    fn para_registro_extrai_metadados_de_sync() {
        let obj = json!({
            "sync_uid": "u-1", "codigo": "789", "titulo": "L",
            "atualizado_em": "2026-07-20T10:00:00Z", "excluido_em": null
        });
        let r = para_registro("livro", obj);
        assert_eq!(r.recurso, "livro");
        assert_eq!(r.sync_uid, "u-1");
        assert_eq!(r.atualizado_em.as_deref(), Some("2026-07-20T10:00:00Z"));
        assert_eq!(r.excluido_em, None);
        assert_eq!(r.dados["codigo"], "789");
    }
}
