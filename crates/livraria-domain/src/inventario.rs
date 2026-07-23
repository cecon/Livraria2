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

/// Agregados de um inventário realizado (US3, FR-012). Vale a identidade
/// `bateram + faltaram + sobraram == total`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct ResumoInventario {
    pub total: i64,
    pub bateram: i64,
    pub faltaram: i64,
    pub sobraram: i64,
    pub soma_diferencas: i64,
}

/// Resume os itens contados de uma sessão a partir de `(sistema, contado)` por livro.
/// `faltaram` = contado < sistema (sumiu da prateleira); `sobraram` = contado > sistema.
pub fn resumir(itens: &[(i64, i64)]) -> ResumoInventario {
    use std::cmp::Ordering;
    let mut r = ResumoInventario::default();
    for &(sistema, contado) in itens {
        let diff = contado - sistema;
        r.total += 1;
        r.soma_diferencas += diff;
        match diff.cmp(&0) {
            Ordering::Equal => r.bateram += 1,
            Ordering::Less => r.faltaram += 1,
            Ordering::Greater => r.sobraram += 1,
        }
    }
    r
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resumo_classifica_e_soma() {
        // (sistema, contado): bateu, faltou (-1), sobrou (+2), bateu
        let r = resumir(&[(5, 5), (3, 2), (1, 3), (0, 0)]);
        assert_eq!(r.total, 4);
        assert_eq!(r.bateram, 2);
        assert_eq!(r.faltaram, 1);
        assert_eq!(r.sobraram, 1);
        assert_eq!(r.soma_diferencas, 1); // 0 -1 +2 +0
        // Identidade.
        assert_eq!(r.bateram + r.faltaram + r.sobraram, r.total);
    }

    #[test]
    fn resumo_vazio() {
        assert_eq!(resumir(&[]), ResumoInventario::default());
    }

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
