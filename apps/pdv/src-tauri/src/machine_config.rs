use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::path::Path;

const DEFAULT_API_URL: &str = "https://livraria.c3bot.com";
const KEYRING_SERVICE: &str = "com.espacodolivro.estoque";
const KEYRING_ACCOUNT: &str = "nuvem-pdv-refresh-token";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineConfig {
    pub api_url: String,
    pub pdv_uid: String,
    pub nome: String,
}

#[derive(Clone, Debug)]
pub struct MachineCredentials {
    pub api_url: String,
    pub pdv_uid: String,
    pub refresh_token: String,
}

pub fn api_url() -> String {
    std::env::var("NUVEM_API_URL").unwrap_or_else(|_| DEFAULT_API_URL.into())
}

pub fn validate_api_url(value: &str) -> Result<String, String> {
    let parsed = Url::parse(value).map_err(|_| "Endereco da API invalido".to_string())?;
    let loopback = matches!(parsed.host_str(), Some("127.0.0.1" | "localhost" | "[::1]"));
    let secure = parsed.scheme() == "https" || (parsed.scheme() == "http" && loopback);
    if !secure
        || parsed.path() != "/"
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Endereco da API exige HTTPS ou localhost, sem caminho".into());
    }
    Ok(value.trim_end_matches('/').to_string())
}

pub fn load(path: Option<&Path>) -> Result<MachineCredentials, String> {
    if let (Ok(api_url), Ok(pdv_uid), Ok(refresh_token)) = (
        std::env::var("NUVEM_API_URL"),
        std::env::var("NUVEM_PDV_UID"),
        std::env::var("NUVEM_PDV_REFRESH_TOKEN"),
    ) {
        return Ok(MachineCredentials {
            api_url,
            pdv_uid,
            refresh_token,
        });
    }
    let config = read(path)?;
    let refresh_token = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|_| "Cofre de credenciais indisponivel".to_string())?
        .get_password()
        .map_err(|_| "Credencial da maquina nao encontrada".to_string())?;
    Ok(MachineCredentials {
        api_url: config.api_url,
        pdv_uid: config.pdv_uid,
        refresh_token,
    })
}

pub fn read(path: Option<&Path>) -> Result<MachineConfig, String> {
    let path = path.ok_or_else(|| "Caminho de configuracao indisponivel".to_string())?;
    let text = std::fs::read_to_string(path)
        .map_err(|_| "Configuracao da maquina nao encontrada".to_string())?;
    serde_json::from_str(&text).map_err(|_| "Configuracao da maquina invalida".to_string())
}

pub fn identity(path: Option<&Path>) -> Result<MachineConfig, String> {
    let config = if let (Ok(api_url), Ok(pdv_uid)) = (
        std::env::var("NUVEM_API_URL"), std::env::var("NUVEM_PDV_UID"),
    ) {
        MachineConfig {
            api_url,
            pdv_uid,
            nome: std::env::var("COMPUTERNAME").unwrap_or_else(|_| "PDV".into()),
        }
    } else {
        read(path)?
    };
    uuid::Uuid::parse_str(&config.pdv_uid).map_err(|_| "ID da maquina invalido".to_string())?;
    if config.nome.trim().is_empty() {
        return Err("Nome da maquina vazio".into());
    }
    Ok(config)
}

pub fn save(path: &Path, config: &MachineConfig, refresh_token: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|_| "Cofre de credenciais indisponivel".to_string())?;
    entry
        .set_password(refresh_token)
        .map_err(|_| "Nao foi possivel proteger a credencial da maquina".to_string())?;
    let result = (|| {
        let parent = path
            .parent()
            .ok_or_else(|| "Caminho de configuracao invalido".to_string())?;
        std::fs::create_dir_all(parent)
            .map_err(|_| "Nao foi possivel criar a configuracao".to_string())?;
        let text = serde_json::to_string_pretty(config)
            .map_err(|_| "Nao foi possivel preparar a configuracao".to_string())?;
        std::fs::write(path, format!("{text}\n"))
            .map_err(|_| "Nao foi possivel salvar a configuracao".to_string())
    })();
    if result.is_err() {
        let _ = entry.delete_credential();
    }
    result
}

pub fn is_configured(path: Option<&Path>) -> bool {
    load(path).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aceita_https_e_loopback() {
        assert!(validate_api_url("https://livraria.c3bot.com").is_ok());
        assert!(validate_api_url("http://127.0.0.1:3003").is_ok());
    }

    #[test]
    fn rejeita_url_insegura_ou_com_caminho() {
        assert!(validate_api_url("http://livraria.c3bot.com").is_err());
        assert!(validate_api_url("https://livraria.c3bot.com/api").is_err());
    }
}
