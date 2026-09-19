use crate::commands::ErroDto;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{path::Path, time::Duration};

#[derive(Deserialize)]
pub struct Autorizacao { pub usuario: String, pub senha: String }

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Produto {
    pub uid: String, pub codigo: String, pub titulo: String, pub autor: Option<String>,
    pub preco_centavos: i64, pub categoria: i64, pub descricao: Option<String>,
    pub saldo_publicado: i64, pub ativo: bool, pub excluido: bool, pub versao: String,
}

pub fn erro(codigo: &str, mensagem: &str) -> ErroDto {
    ErroDto { codigo: codigo.into(), mensagem: mensagem.into() }
}
pub fn rede(_: impl std::fmt::Display) -> ErroDto {
    erro("SEM_CONEXAO", "Não foi possível acessar a retaguarda. Confira a conexão e tente novamente.")
}

pub async fn salvar(path: Option<&Path>, pedido: &Value, auth: Autorizacao) -> Result<Produto, ErroDto> {
    let config = crate::machine_config::identity(path).map_err(rede)?;
    let base = crate::machine_config::validate_api_url(&config.api_url).map_err(rede)?;
    let client = Client::builder().timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none()).build().map_err(rede)?;
    let response = client.post(format!("{base}/api/pdv/produtos/autorizacao"))
        .json(&serde_json::json!({"usuario":auth.usuario,"senha":auth.senha}))
        .send().await.map_err(rede)?;
    let login = resposta(response).await?;
    let token = login["accessToken"].as_str().ok_or_else(|| rede("token"))?;
    let response = client.post(format!("{base}/api/pdv/produtos"))
        .bearer_auth(token).json(pedido).send().await.map_err(rede)?;
    serde_json::from_value(resposta(response).await?).map_err(rede)
}

async fn resposta(response: reqwest::Response) -> Result<Value, ErroDto> {
    let status = response.status();
    let value: Value = response.json().await.map_err(rede)?;
    if status.is_success() { return Ok(value); }
    let (code, message) = match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => ("SEM_PERMISSAO", "Informe as credenciais de um administrador ativo."),
        StatusCode::CONFLICT if value["message"] == "PRODUTO_ALTERADO" => ("PRODUTO_ALTERADO", "O produto ou estoque mudou. Atualize os dados e confira antes de confirmar novamente."),
        StatusCode::CONFLICT => ("CONFLITO", "Código ou tentativa já existente. Consulte o produto antes de repetir."),
        StatusCode::BAD_REQUEST => ("DADOS_INVALIDOS", "Confira os dados informados."),
        StatusCode::NOT_FOUND => ("INDISPONIVEL", "Produto ou serviço indisponível. Atualize o catálogo ou a retaguarda."),
        _ => ("SEM_CONEXAO", "A retaguarda não confirmou a operação. Tente novamente com os mesmos dados."),
    };
    Err(erro(code, message))
}
