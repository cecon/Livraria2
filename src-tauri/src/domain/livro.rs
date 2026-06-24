//! Modelo de domínio do Livro e regra de selo de estoque (FR-051).

use super::categoria::Categoria;
use super::dinheiro::Dinheiro;
use super::texto::normalize;

#[derive(Debug, Clone, PartialEq)]
pub struct Livro {
    pub codigo: String,
    pub titulo: String,
    pub autor: Option<String>,
    pub preco: Dinheiro,
    pub categoria: Categoria,
    pub estoque: i64,
    pub descricao: Option<String>,
    /// EAN/ISBN opcional, distinto do `codigo` interno (FR-022a). Chave de bipagem.
    pub codigo_barras: Option<String>,
    /// Custo médio ponderado (centavos), recalculado a cada entrada (ADR-0009).
    pub custo_medio: Dinheiro,
}

/// Selo de estoque exibido na UI (FR-051).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeloEstoque {
    Esgotado,
    Baixo,
    Normal,
}

impl Livro {
    /// Regra de domínio: ≤0 Esgotado; ≤3 Baixo; senão Normal.
    pub fn selo(&self) -> SeloEstoque {
        if self.estoque <= 0 {
            SeloEstoque::Esgotado
        } else if self.estoque <= 3 {
            SeloEstoque::Baixo
        } else {
            SeloEstoque::Normal
        }
    }

    /// Considerado em estoque baixo para o dashboard (≤3, inclui esgotado).
    pub fn estoque_baixo(&self) -> bool {
        self.estoque <= 3
    }

    /// Texto normalizado para busca sem acento/caixa (FR-021): título + autor.
    pub fn busca_norm(&self) -> String {
        let autor = self.autor.as_deref().unwrap_or("");
        normalize(&format!("{} {}", self.titulo, autor))
    }

    /// Estoque após vender `qtd` unidades, com piso em zero (nunca negativo).
    pub fn estoque_apos_venda(&self, qtd: i64) -> i64 {
        (self.estoque - qtd).max(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn livro(estoque: i64) -> Livro {
        Livro {
            codigo: "9788573671469".into(),
            titulo: "A Cruz de Cristo".into(),
            autor: Some("John Stott".into()),
            preco: Dinheiro::de_centavos(3000),
            categoria: Categoria::EstudoTeologia,
            estoque,
            descricao: None,
            codigo_barras: None,
            custo_medio: Dinheiro::ZERO,
        }
    }

    #[test]
    fn selo_por_faixa() {
        assert_eq!(livro(0).selo(), SeloEstoque::Esgotado);
        assert_eq!(livro(-2).selo(), SeloEstoque::Esgotado);
        assert_eq!(livro(1).selo(), SeloEstoque::Baixo);
        assert_eq!(livro(3).selo(), SeloEstoque::Baixo);
        assert_eq!(livro(4).selo(), SeloEstoque::Normal);
    }

    #[test]
    fn busca_norm_sem_acento() {
        let l = Livro {
            titulo: "Bíblia de Estudo".into(),
            autor: None,
            ..livro(5)
        };
        assert_eq!(l.busca_norm(), "biblia de estudo ");
    }

    #[test]
    fn estoque_nunca_negativo() {
        assert_eq!(livro(2).estoque_apos_venda(5), 0);
        assert_eq!(livro(10).estoque_apos_venda(3), 7);
    }
}
