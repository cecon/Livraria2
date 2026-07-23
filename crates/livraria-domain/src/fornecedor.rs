//! Modelo de domínio do Fornecedor (feature 003). Regras puras, sem UI/banco.

use super::erros::ErroDominio;
use super::texto::normalize;

#[derive(Debug, Clone, PartialEq)]
pub struct Fornecedor {
    pub id: i64,
    pub nome: String,
    pub documento: Option<String>,
    pub telefone: Option<String>,
    pub email: Option<String>,
    pub observacoes: Option<String>,
    pub ativo: bool,
}

impl Fornecedor {
    /// Nome normalizado (sem acento/caixa) para busca e unicidade (FR-004).
    pub fn nome_norm(&self) -> String {
        normalize(&self.nome)
    }

    /// Valida o fornecedor: nome obrigatório (não vazio após trim).
    pub fn validar(&self) -> Result<(), ErroDominio> {
        if self.nome.trim().is_empty() {
            return Err(ErroDominio::NomeObrigatorio);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn forn(nome: &str) -> Fornecedor {
        Fornecedor {
            id: 0,
            nome: nome.into(),
            documento: None,
            telefone: None,
            email: None,
            observacoes: None,
            ativo: true,
        }
    }

    #[test]
    fn nome_norm_sem_acento_caixa() {
        assert_eq!(forn("Editora Água Viva").nome_norm(), "editora agua viva");
        // mesmo nome em caixas diferentes normaliza igual (base da unicidade)
        assert_eq!(forn("EDITORA X").nome_norm(), forn("editora x").nome_norm());
    }

    #[test]
    fn valida_nome_obrigatorio() {
        assert!(forn("Editora X").validar().is_ok());
        assert_eq!(forn("   ").validar(), Err(ErroDominio::NomeObrigatorio));
    }
}
