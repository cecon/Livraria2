use super::diagnostico::Diagnostico;
use crate::application::api_sync::{EnvioApi, NuvemApi, PaginaApi};
use crate::application::ports::RepoErro;
use async_trait::async_trait;
use reqwest::{Client, Url};
use serde_json::{json, Value};
use std::path::Path;
use std::time::Duration;

#[derive(serde::Deserialize)]
pub struct PaginaReferencias { pub registros: Vec<Value>, pub proximo: Option<String> }

pub struct ApiSync {
    client: Client,
    base: String,
    token: String,
    diagnostico: Diagnostico,
}

fn erro(_: impl std::fmt::Display) -> RepoErro {
    RepoErro::Persistencia("Falha de comunicacao com a API; operacao preservada para reenvio".into())
}

impl ApiSync {
    pub async fn referencias(&self, recurso: &str, after: &str) -> Result<PaginaReferencias, RepoErro> {
        let request = self.client.get(format!("{}/referencias/{recurso}", self.base))
            .bearer_auth(&self.token).query(&[("after", after)]);
        serde_json::from_value(self.diagnostico.executar(request, "Receber referencias").await?).map_err(erro)
    }
    #[cfg(test)]
    pub(crate) fn teste(base: String) -> Self {
        let diagnostico = Diagnostico { origem: base.clone(), pdv_uid: String::new(), arquivo: None };
        Self { client: Client::new(), base, token: "test".into(), diagnostico }
    }
    pub async fn mapa_capas(&self, after: Option<&str>) -> Result<crate::image_bootstrap::ImagePage, RepoErro> {
        let mut req = self.client.get(format!("{}/produtos/imagens", self.base)).bearer_auth(&self.token);
        if let Some(after) = after { req = req.query(&[("after", after)]); }
        req.send().await.map_err(erro)?.error_for_status().map_err(erro)?.json().await.map_err(erro)
    }
    pub async fn enviar_capa(&self, imagem: &str) -> Result<reqwest::Response, reqwest::Error> {
        self.client.post(format!("{}/capas", self.base)).bearer_auth(&self.token)
            .json(&json!({ "imagem": imagem })).send().await
    }
    pub async fn baixar_capa(&self, uid: &str) -> Result<Vec<u8>, RepoErro> {
        uuid::Uuid::parse_str(uid).map_err(erro)?;
        let mut response = self.client.get(format!("{}/capas/{uid}", self.base))
            .bearer_auth(&self.token).timeout(Duration::from_secs(8)).send().await.map_err(erro)?;
        if !response.status().is_success() || response.content_length().is_some_and(|n| n > 512_000) {
            return Err(erro("Imagem indisponível"));
        }
        let mut data = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(erro)? {
            if data.len() + chunk.len() > 512_000 { return Err(erro("Imagem excessiva")); }
            data.extend_from_slice(&chunk);
        }
        if data.len() < 12 || &data[..4] != b"RIFF" || &data[8..12] != b"WEBP" { return Err(erro("Imagem inválida")); }
        Ok(data)
    }
    pub async fn cadastrar_produto(&self, pedido: &Value) -> Result<reqwest::Response, reqwest::Error> {
        self.client.post(format!("{}/produtos", self.base))
            .bearer_auth(&self.token).json(pedido).send().await
    }

    pub async fn llms(&self, turno: &str, testar: Option<&str>) -> Result<Value, RepoErro> {
        uuid::Uuid::parse_str(turno).map_err(erro)?;
        let request = if let Some(uid) = testar {
            uuid::Uuid::parse_str(uid).map_err(erro)?;
            self.client.post(format!("{}/llms/{uid}/testar", self.base))
                .json(&json!({ "turnoUid": turno }))
        } else {
            self.client.get(format!("{}/llms", self.base)).query(&[("turnoUid", turno)])
        };
        self.diagnostico.executar(request.bearer_auth(&self.token), "Consultar LLM").await
    }

    pub async fn produto(&self, codigo: Option<&str>, uid: Option<&str>) -> Result<Value, RepoErro> {
        let request = if let Some(codigo) = codigo {
            self.client.get(format!("{}/produtos/codigo", self.base)).query(&[("codigo", codigo)])
        } else {
            let uid = uid.ok_or_else(|| erro("uid"))?;
            uuid::Uuid::parse_str(uid).map_err(erro)?;
            self.client.get(format!("{}/produtos/{uid}", self.base))
        };
        let data = self.diagnostico.executar(request.bearer_auth(&self.token), "Consultar produto").await?;
        data.get("produto").cloned().ok_or_else(|| erro("Resposta de produto inválida"))
    }
    pub async fn enviar_movimento(&self, body: &Value) -> Result<Value, RepoErro> {
        let request = self.client.post(format!("{}/caixa-movimentos", self.base))
            .bearer_auth(&self.token).json(body);
        self.diagnostico.executar(request, "Enviar movimento de caixa").await
    }

    pub async fn enviar_turno(&self, uid: &str, fechamento: bool, body: &Value) -> Result<Value, RepoErro> {
        let path = if fechamento { format!("{}/turnos/{uid}/encerramento", self.base) }
            else { format!("{}/turnos", self.base) };
        let request = self.client.post(path).bearer_auth(&self.token).json(body);
        self.diagnostico.executar(request, if fechamento { "Enviar fechamento de turno" } else { "Enviar abertura de turno" }).await
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
        let diagnostico = Diagnostico { origem: parsed.origin().ascii_serialization(), pdv_uid: uid.clone(),
            arquivo: path.and_then(|p| p.parent()).map(|p| p.join("logs").join("sync.log")) };
        let request = client.post(format!("{base}/renovar"))
            .json(&json!({"pdvUid":uid,"refreshToken":refresh}));
        let value = diagnostico.executar(request, "Renovar credencial").await?;
        let token = value.get("accessToken").and_then(Value::as_str).ok_or_else(|| erro("token"))?.to_string();
        Ok(Self { client, base, token, diagnostico })
    }

}

#[async_trait]
impl NuvemApi for ApiSync {
    async fn pagina(&self, cursor: &str) -> Result<PaginaApi, RepoErro> {
        let request = self.client.get(format!("{}/catalogo", self.base))
            .bearer_auth(&self.token).query(&[("cursor", cursor), ("limite", "100")]);
        serde_json::from_value(self.diagnostico.executar(request, "Receber catalogo").await?).map_err(erro)
    }

    async fn confirmar(&self, cursor: &str) -> Result<(), RepoErro> {
        let request = self.client.post(format!("{}/catalogo/confirmacao", self.base))
            .bearer_auth(&self.token).json(&json!({"cursorAplicado":cursor}));
        let value = self.diagnostico.executar(request, "Confirmar catalogo").await?;
        if value.get("cursorAplicado").and_then(Value::as_str) != Some(cursor) { return Err(erro("cursor")); }
        Ok(())
    }

    async fn enviar(&self, envio: &EnvioApi) -> Result<Value, RepoErro> {
        let path = if envio.cancelamento {
            format!("{}/vendas/{}/cancelamento", self.base, envio.uid)
        } else { format!("{}/vendas", self.base) };
        let request = self.client.post(path).bearer_auth(&self.token).json(&envio.corpo);
        self.diagnostico.executar(request, if envio.cancelamento { "Enviar cancelamento" } else { "Enviar venda" }).await
    }
}
