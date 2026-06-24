//! Regras puras do inventário (ADR-0010): modo, status e contagem efetiva no
//! fechamento. A diferença em si reusa `estoque::diferenca_contagem`.

/// Modo da sessão de inventário.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModoInventario {
    Parcial,
    Total,
}

impl ModoInventario {
    pub fn as_str(self) -> &'static str {
        match self {
            ModoInventario::Parcial => "parcial",
            ModoInventario::Total => "total",
        }
    }
    pub fn de_str(s: &str) -> Option<ModoInventario> {
        match s {
            "parcial" => Some(ModoInventario::Parcial),
            "total" => Some(ModoInventario::Total),
            _ => None,
        }
    }
}

/// Estado de uma sessão de inventário.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatusSessao {
    Aberta,
    Fechada,
    Cancelada,
}

impl StatusSessao {
    pub fn as_str(self) -> &'static str {
        match self {
            StatusSessao::Aberta => "aberta",
            StatusSessao::Fechada => "fechada",
            StatusSessao::Cancelada => "cancelada",
        }
    }
}

/// Contagem efetiva de um livro no fechamento (FR-025/FR-026):
/// - Parcial: só ajusta livros contados (`Some`); não contados ficam intactos (`None`).
/// - Total: livro não contado conta como 0 (zera).
pub fn contagem_efetiva(modo: ModoInventario, contada: Option<i64>) -> Option<i64> {
    match modo {
        ModoInventario::Parcial => contada,
        ModoInventario::Total => Some(contada.unwrap_or(0)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn modo_ida_e_volta() {
        assert_eq!(ModoInventario::de_str("parcial"), Some(ModoInventario::Parcial));
        assert_eq!(ModoInventario::de_str("total"), Some(ModoInventario::Total));
        assert_eq!(ModoInventario::de_str("x"), None);
        assert_eq!(ModoInventario::Parcial.as_str(), "parcial");
    }

    #[test]
    fn parcial_so_ajusta_contados() {
        assert_eq!(contagem_efetiva(ModoInventario::Parcial, Some(4)), Some(4));
        // não contado permanece intacto (sem ajuste)
        assert_eq!(contagem_efetiva(ModoInventario::Parcial, None), None);
    }

    #[test]
    fn total_zera_nao_contados() {
        assert_eq!(contagem_efetiva(ModoInventario::Total, Some(4)), Some(4));
        // não bipado no modo total conta como 0
        assert_eq!(contagem_efetiva(ModoInventario::Total, None), Some(0));
    }

    #[test]
    fn status_textos() {
        assert_eq!(StatusSessao::Aberta.as_str(), "aberta");
        assert_eq!(StatusSessao::Fechada.as_str(), "fechada");
        assert_eq!(StatusSessao::Cancelada.as_str(), "cancelada");
    }
}
