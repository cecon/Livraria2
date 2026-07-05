//! Destinação do valor das vendas (ADR-0014). "Loja" é a destinação de sistema
//! (padrão): o saldo livre de um livro pertence a ela por definição; carimbos têm
//! prioridade de venda. Regras puras — sem UI, sem banco.

use serde::{Deserialize, Serialize};

// Mesmas regras de nome do cadastro de formas (FR-003 — DRY).
pub use super::pagamento::{nome_normalizado, nome_valido};

/// Destinação do cadastro (FR-001). A ordem é a ordem de baixa dos carimbos.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Destinacao {
    pub id: i64,
    pub nome: String,
    /// Loja: não exclui, não desativa, não reordena; sempre primeira (FR-002).
    pub de_sistema: bool,
    pub ativa: bool,
    pub ordem: i64,
}

impl Destinacao {
    /// Excluir só destinações livres nunca usadas (FR-004).
    pub fn pode_excluir(&self, em_uso: bool) -> bool {
        !self.de_sistema && !em_uso
    }

    /// Desativar nunca a Loja (FR-002/FR-005).
    pub fn pode_desativar(&self) -> bool {
        !self.de_sistema
    }

    /// Reordenar nunca a Loja — âncora da ordem de baixa (FR-002).
    pub fn pode_reordenar(&self) -> bool {
        !self.de_sistema
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dest(de_sistema: bool) -> Destinacao {
        Destinacao {
            id: 1,
            nome: "Missões".into(),
            de_sistema,
            ativa: true,
            ordem: 1,
        }
    }

    #[test]
    fn loja_protegida_de_tudo() {
        let loja = dest(true);
        assert!(!loja.pode_excluir(false));
        assert!(!loja.pode_desativar());
        assert!(!loja.pode_reordenar());
    }

    #[test]
    fn livre_pode_gerir_mas_nao_excluir_em_uso() {
        let d = dest(false);
        assert!(d.pode_excluir(false));
        assert!(!d.pode_excluir(true));
        assert!(d.pode_desativar());
        assert!(d.pode_reordenar());
    }

    #[test]
    fn nome_reusa_regra_normalizada_da_005() {
        assert_eq!(nome_normalizado(" MISSÕES "), "missoes");
        assert!(!nome_valido("  "));
    }
}
