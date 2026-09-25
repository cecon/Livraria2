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
    let response = client
        .post(format!("{api_url}/api/pdv/configurar"))
        .json(&json!({"nome": name, "usuario": user, "senha": input.senha}))
        .send()
        .await
        .map_err(|_| "Nao foi possivel acessar a nuvem".to_string())?;
    if response.status() == StatusCode::UNAUTHORIZED {
        return Err("Usuario ou senha invalidos".into());
    }
    let value = success_json(response, "Falha ao configurar a maquina").await?;
    let pdv_uid = value.get("uid").and_then(Value::as_str)
        .ok_or_else(|| "Maquina criada sem identificacao valida".to_string())?.to_string();
    let credential = refresh_token(&value)?;
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
            refresh_token: None,
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
