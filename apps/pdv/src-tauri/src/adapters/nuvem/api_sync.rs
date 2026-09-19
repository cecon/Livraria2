use crate::application::api_sync::{EnvioApi, NuvemApi, PaginaApi};
use crate::application::ports::RepoErro;
use async_trait::async_trait;
use reqwest::{Client, Url};
use serde_json::{json, Value};
use std::path::Path;
use std::time::Duration;

pub struct ApiSync {
    client: Client,
    base: String,
    token: String,
}

fn erro(_: impl std::fmt::Display) -> RepoErro {
    RepoErro::Persistencia("Falha de comunicacao com a API; operacao preservada para reenvio".into())
}

impl ApiSync {
    pub async fn produto(&self, codigo: Option<&str>, uid: Option<&str>) -> Result<Value, RepoErro> {
        let request = if let Some(codigo) = codigo {
            self.client.get(format!("{}/produtos/codigo", self.base)).query(&[("codigo", codigo)])
        } else {
            let uid = uid.ok_or_else(|| erro("uid"))?;
            uuid::Uuid::parse_str(uid).map_err(erro)?;
            self.client.get(format!("{}/produtos/{uid}", self.base))
        };
        let data = Self::resposta(request.bearer_auth(&self.token).send().await.map_err(erro)?).await?;
        data.get("produto").cloned().ok_or_else(|| erro("Resposta de produto inválida"))
    }
    pub async fn enviar_movimento(&self, body: &Value) -> Result<Value, RepoErro> {
        let response = self.client.post(format!("{}/caixa-movimentos", self.base))
            .bearer_auth(&self.token).json(body).send().await.map_err(erro)?;
        Self::resposta(response).await
    }

    pub async fn enviar_turno(&self, uid: &str, fechamento: bool, body: &Value) -> Result<Value, RepoErro> {
        let path = if fechamento { format!("{}/turnos/{uid}/encerramento", self.base) }
            else { format!("{}/turnos", self.base) };
        let response = self.client.post(path).bearer_auth(&self.token)
            .json(body).send().await.map_err(erro)?;
        Self::resposta(response).await
    }

    pub async fn conectar() -> Result<Self, RepoErro> {
        Self::conectar_com_config(None).await
    }

    pub async fn conectar_com_config(path: Option<&Path>) -> Result<Self, RepoErro> {
        let credentials = crate::machine_config::load(path).map_err(erro)?;
        let url = credentials.api_url;
        let uid = credentials.pdv_uid;
        let refresh = credentials.refresh_token;
        let parsed = Url::parse(&url).map_err(erro)?;
        let loopback = matches!(parsed.host_str(), Some("127.0.0.1" | "localhost" | "[::1]"));
        if (parsed.scheme() != "https" && !(parsed.scheme() == "http" && loopback)) ||
            parsed.path() != "/" || parsed.query().is_some() || parsed.fragment().is_some() ||
            !parsed.username().is_empty() || parsed.password().is_some() {
            return Err(RepoErro::Persistencia("URL da API exige HTTPS ou localhost, sem credenciais/caminho".into()));
        }
        uuid::Uuid::parse_str(&uid).map_err(erro)?;
        let client = Client::builder().timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(5)).redirect(reqwest::redirect::Policy::none()).build().map_err(erro)?;
        let base = format!("{}/api/pdv", url.trim_end_matches('/'));
        let response = client.post(format!("{base}/renovar"))
            .json(&json!({"pdvUid":uid,"refreshToken":refresh})).send().await.map_err(erro)?;
        if !response.status().is_success() {
            return Err(RepoErro::Persistencia(format!("Renovacao de credencial API HTTP {}", response.status())));
        }
        let value: Value = response.json().await.map_err(erro)?;
        let token = value.get("accessToken").and_then(Value::as_str).ok_or_else(|| erro("token"))?.to_string();
        Ok(Self { client, base, token })
    }

    async fn resposta(response: reqwest::Response) -> Result<Value, RepoErro> {
        if !response.status().is_success() {
            return Err(RepoErro::Persistencia(format!("API HTTP {}; dados mantidos para reenvio", response.status())));
        }
        response.json().await.map_err(erro)
    }
}

#[async_trait]
impl NuvemApi for ApiSync {
    async fn pagina(&self, cursor: &str) -> Result<PaginaApi, RepoErro> {
        let response = self.client.get(format!("{}/catalogo", self.base))
            .bearer_auth(&self.token).query(&[("cursor", cursor), ("limite", "100")])
            .send().await.map_err(erro)?;
        serde_json::from_value(Self::resposta(response).await?).map_err(erro)
    }

    async fn confirmar(&self, cursor: &str) -> Result<(), RepoErro> {
        let response = self.client.post(format!("{}/catalogo/confirmacao", self.base))
            .bearer_auth(&self.token).json(&json!({"cursorAplicado":cursor})).send().await.map_err(erro)?;
        let value = Self::resposta(response).await?;
        if value.get("cursorAplicado").and_then(Value::as_str) != Some(cursor) { return Err(erro("cursor")); }
        Ok(())
    }

    async fn enviar(&self, envio: &EnvioApi) -> Result<Value, RepoErro> {
        let path = if envio.cancelamento {
            format!("{}/vendas/{}/cancelamento", self.base, envio.uid)
        } else { format!("{}/vendas", self.base) };
        let response = self.client.post(path).bearer_auth(&self.token)
            .json(&envio.corpo).send().await.map_err(erro)?;
        Self::resposta(response).await
    }
}
