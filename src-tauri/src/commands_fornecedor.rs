//! Comandos Tauri de fornecedores (US1). Separado para respeitar o limite de 300 linhas.

use crate::adapters::persistencia::fornecedor_repo::SeaFornecedorRepo;
use crate::application::fornecedores;
use crate::commands::{AppState, ErroDto};
use crate::domain::fornecedor::Fornecedor;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FornecedorDto {
    pub id: i64,
    pub nome: String,
    pub documento: Option<String>,
    pub telefone: Option<String>,
    pub email: Option<String>,
    pub observacoes: Option<String>,
    pub ativo: bool,
}

impl From<Fornecedor> for FornecedorDto {
    fn from(f: Fornecedor) -> Self {
        FornecedorDto {
            id: f.id,
            nome: f.nome,
            documento: f.documento,
            telefone: f.telefone,
            email: f.email,
            observacoes: f.observacoes,
            ativo: f.ativo,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FornecedorInput {
    #[serde(default)]
    pub id: i64,
    pub nome: String,
    pub documento: Option<String>,
    pub telefone: Option<String>,
    pub email: Option<String>,
    pub observacoes: Option<String>,
}

impl FornecedorInput {
    fn para_dominio(self) -> Fornecedor {
        Fornecedor {
            id: self.id,
            nome: self.nome,
            documento: self.documento,
            telefone: self.telefone,
            email: self.email,
            observacoes: self.observacoes,
            ativo: true,
        }
    }
}

#[tauri::command]
pub async fn fornecedores_listar(
    state: tauri::State<'_, AppState>,
    termo: Option<String>,
) -> Result<Vec<FornecedorDto>, ErroDto> {
    let repo = SeaFornecedorRepo::new(state.db.clone());
    let fs = fornecedores::listar(termo.as_deref().unwrap_or(""), &repo).await?;
    Ok(fs.into_iter().map(FornecedorDto::from).collect())
}

#[tauri::command]
pub async fn fornecedor_salvar(
    state: tauri::State<'_, AppState>,
    fornecedor: FornecedorInput,
) -> Result<FornecedorDto, ErroDto> {
    let repo = SeaFornecedorRepo::new(state.db.clone());
    let f = fornecedores::salvar(fornecedor.para_dominio(), &repo).await?;
    Ok(FornecedorDto::from(f))
}

#[tauri::command]
pub async fn fornecedor_excluir(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), ErroDto> {
    let repo = SeaFornecedorRepo::new(state.db.clone());
    fornecedores::excluir(id, &repo).await?;
    Ok(())
}
