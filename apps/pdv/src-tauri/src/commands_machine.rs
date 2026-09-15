use crate::commands::AppState;
use crate::machine_config::{self, MachineConfig};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineStateDto {
    pub configured: bool,
    pub nome: Option<String>,
    pub nome_sugerido: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureMachineInput {
    pub nome: String,
    pub usuario: String,
    pub senha: String,
}

#[tauri::command]
pub fn estado_maquina(state: tauri::State<'_, AppState>) -> MachineStateDto {
    let config = machine_config::read(state.machine_config_path.as_deref()).ok();
    let configured = machine_config::is_configured(state.machine_config_path.as_deref());
    MachineStateDto {
        configured,
        nome: config.map(|value| value.nome),
        nome_sugerido: suggested_name(),
    }
}

#[tauri::command]
pub async fn configurar_maquina(
    state: tauri::State<'_, AppState>,
    input: ConfigureMachineInput,
) -> Result<MachineStateDto, String> {
    let name = input.nome.trim();
    let user = input.usuario.trim().to_lowercase();
    if name.is_empty() || name.chars().count() > 100 {
        return Err("Informe um nome de maquina com ate 100 caracteres".into());
    }
    if user.is_empty() || input.senha.is_empty() {
        return Err("Informe o usuario administrador e a senha".into());
    }
    let api_url = machine_config::validate_api_url(&machine_config::api_url())?;
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Nao foi possivel iniciar a conexao".to_string())?;
    let base = format!("{api_url}/api/v1");
    let login = client
        .post(format!("{base}/auth/login"))
        .json(&json!({"usuario": user, "senha": input.senha}))
        .send()
        .await
        .map_err(|_| "Nao foi possivel acessar a nuvem".to_string())?;
    if login.status() == StatusCode::UNAUTHORIZED {
        return Err("Usuario ou senha invalidos".into());
    }
    let login = success_json(login, "Falha ao autenticar na nuvem").await?;
    let access = login
        .get("accessToken")
        .and_then(Value::as_str)
        .ok_or_else(|| "Resposta de autenticacao invalida".to_string())?;
    let principal = success_json(
        client
            .get(format!("{base}/auth/me"))
            .bearer_auth(access)
            .send()
            .await
            .map_err(|_| "Nao foi possivel validar o usuario".to_string())?,
        "Falha ao validar o usuario",
    )
    .await?;
    if principal.get("perfil").and_then(Value::as_str) != Some("admin") {
        return Err("A configuracao inicial exige um usuario administrador".into());
    }
    let owner_uid = principal
        .get("uid")
        .and_then(Value::as_str)
        .ok_or_else(|| "Usuario sem identificacao valida".to_string())?;
    let devices = success_json(
        client
            .get(format!("{base}/pdvs"))
            .bearer_auth(access)
            .send()
            .await
            .map_err(|_| "Nao foi possivel consultar as maquinas".to_string())?,
        "Falha ao consultar as maquinas",
    )
    .await?;
    let existing_uid = devices
        .as_array()
        .and_then(|items| {
            items.iter().find(|item| {
                item.get("ativo").and_then(Value::as_bool) == Some(true)
                    && item
                        .get("nome")
                        .and_then(Value::as_str)
                        .is_some_and(|existing| existing.eq_ignore_ascii_case(name))
            })
        })
        .and_then(|item| item.get("uid"))
        .and_then(Value::as_str);
    let (pdv_uid, credential) = if let Some(uid) = existing_uid {
        let value = success_json(
            client
                .post(format!("{base}/pdvs/{uid}/token"))
                .bearer_auth(access)
                .send()
                .await
                .map_err(|_| "Nao foi possivel renovar a maquina".to_string())?,
            "Falha ao renovar a maquina",
        )
        .await?;
        (uid.to_string(), refresh_token(&value)?)
    } else {
        let value = success_json(
            client
                .post(format!("{base}/pdvs"))
                .bearer_auth(access)
                .json(&json!({"nome": name, "usuarioUid": owner_uid}))
                .send()
                .await
                .map_err(|_| "Nao foi possivel criar a maquina".to_string())?,
            "Falha ao criar a maquina",
        )
        .await?;
        let uid = value
            .get("uid")
            .and_then(Value::as_str)
            .ok_or_else(|| "Maquina criada sem identificacao valida".to_string())?;
        (uid.to_string(), refresh_token(&value)?)
    };
    let path = state
        .machine_config_path
        .as_deref()
        .ok_or_else(|| "Pasta de configuracao indisponivel".to_string())?;
    machine_config::save(
        path,
        &MachineConfig {
            api_url,
            pdv_uid,
            nome: name.to_string(),
        },
        &credential,
    )?;
    Ok(MachineStateDto {
        configured: true,
        nome: Some(name.into()),
        nome_sugerido: suggested_name(),
    })
}

async fn success_json(response: reqwest::Response, message: &str) -> Result<Value, String> {
    if !response.status().is_success() {
        return Err(format!("{message} (HTTP {})", response.status().as_u16()));
    }
    response
        .json()
        .await
        .map_err(|_| format!("{message}: resposta invalida"))
}

fn refresh_token(value: &Value) -> Result<String, String> {
    value
        .get("refreshToken")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "A nuvem nao devolveu a credencial da maquina".to_string())
}

fn suggested_name() -> String {
    let host = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "ESTACAO".into());
    format!("PDV - {}", host.trim().to_uppercase())
}
