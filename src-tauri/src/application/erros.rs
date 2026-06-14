//! Erro da camada de aplicação: combina erro de domínio e de infraestrutura.

use crate::application::ports::RepoErro;
use crate::domain::erros::ErroDominio;

#[derive(Debug, thiserror::Error)]
pub enum ErroApp {
    #[error(transparent)]
    Dominio(#[from] ErroDominio),
    #[error(transparent)]
    Repo(#[from] RepoErro),
}

impl ErroApp {
    /// Código estável para o DTO de erro que cruza a fronteira Tauri.
    pub fn codigo(&self) -> String {
        match self {
            ErroApp::Dominio(e) => e.codigo().to_string(),
            ErroApp::Repo(_) => "ERRO_PERSISTENCIA".to_string(),
        }
    }
}
