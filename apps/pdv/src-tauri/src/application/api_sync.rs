use crate::application::ports::RepoErro;
use crate::application::sincronizacao::ResumoSync;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProdutoApi {
    pub codigo: String,
    pub titulo: String,
    pub autor: Option<String>,
    pub preco_centavos: i64,
    pub ativo: bool,
    #[serde(default)]
    pub categoria: i64,
    pub descricao: Option<String>,
    #[serde(default)]
    pub busca_norm: String,
    #[serde(default)]
    pub saldo_publicado: i64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventoApi {
    pub sequencia: String,
    pub produto_uid: String,
    pub operacao: String,
    pub produto: Option<ProdutoApi>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginaApi {
    pub versao: u8,
    pub alteracoes: Vec<EventoApi>,
    pub proximo_cursor: String,
    pub tem_mais: bool,
}

pub struct EnvioApi {
    pub chave: String,
    pub uid: String,
    pub cancelamento: bool,
    pub corpo: Value,
}

#[async_trait]
pub trait NuvemApi: Send + Sync {
    async fn pagina(&self, cursor: &str) -> Result<PaginaApi, RepoErro>;
    async fn confirmar(&self, cursor: &str) -> Result<(), RepoErro>;
    async fn enviar(&self, envio: &EnvioApi) -> Result<Value, RepoErro>;
}

#[async_trait]
pub trait ReplicaApi: Send + Sync {
    async fn preparar_envios(&self) -> Result<(), RepoErro>;
    async fn envios(&self) -> Result<Vec<EnvioApi>, RepoErro>;
    async fn confirmar_envio(&self, envio: &EnvioApi, resposta: &Value) -> Result<(), RepoErro>;
    async fn cursor(&self) -> Result<String, RepoErro>;
    async fn aplicar_pagina(&self, pagina: &PaginaApi) -> Result<(), RepoErro>;
}

pub fn validar_pagina(pagina: &PaginaApi, inicio: &str) -> Result<(), RepoErro> {
    let erro = || RepoErro::Persistencia("Pagina API invalida; cursor preservado".into());
    if pagina.versao != 1 { return Err(erro()); }
    let mut last = inicio.parse::<u64>().map_err(|_| erro())?;
    for event in &pagina.alteracoes {
        let n = event.sequencia.parse::<u64>().map_err(|_| erro())?;
        if n <= last || uuid::Uuid::parse_str(&event.produto_uid).is_err() { return Err(erro()); }
        match (event.operacao.as_str(), &event.produto) {
            ("delete", None) => {}
            ("upsert", Some(p)) if p.preco_centavos >= 0 &&
                p.preco_centavos <= 9_007_199_254_740_991 && !p.codigo.is_empty() &&
                !p.titulo.is_empty() && p.ativo => {}
            _ => return Err(erro()),
        }
        last = n;
    }
    if pagina.proximo_cursor != last.to_string() ||
        (pagina.tem_mais && pagina.alteracoes.is_empty()) { return Err(erro()); }
    Ok(())
}

pub async fn sincronizar_api(nuvem: &dyn NuvemApi, local: &dyn ReplicaApi) -> Result<ResumoSync, RepoErro> {
    let mut resumo = ResumoSync::default();
    local.preparar_envios().await?;
    for envio in local.envios().await? {
        let resposta = nuvem.enviar(&envio).await?;
        if resposta.get("pedidoUid").and_then(Value::as_str) != Some(&envio.uid) ||
            (envio.cancelamento && resposta.get("cancelado") != Some(&Value::Bool(true))) ||
            (!envio.cancelamento && resposta.get("recebido") != Some(&Value::Bool(true))) {
            return Err(RepoErro::Persistencia("Recibo API invalido".into()));
        }
        local.confirmar_envio(&envio, &resposta).await?;
        resumo.enviados += 1;
    }
    let mut cursor = local.cursor().await?;
    // Recover acknowledgement lost after a successful local commit.
    nuvem.confirmar(&cursor).await?;
    for _ in 0..100 {
        let pagina = nuvem.pagina(&cursor).await?;
        validar_pagina(&pagina, &cursor)?;
        local.aplicar_pagina(&pagina).await?;
        resumo.recebidos += pagina.alteracoes.len();
        cursor = pagina.proximo_cursor;
        nuvem.confirmar(&cursor).await?;
        if !pagina.tem_mais { break; }
    }
    Ok(resumo)
}
