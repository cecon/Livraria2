//! Enum fixo de categorias 0–6 (Constituição, Princípio VI — preservar do legado).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(into = "i64", try_from = "i64")]
pub enum Categoria {
    NaoCategorizado, // 0
    Biblias,         // 1
    Infantil,        // 2
    Familia,         // 3
    Devocional,      // 4
    EstudoTeologia,  // 5
    Ficcao,          // 6
}

impl Categoria {
    pub const TODAS: [Categoria; 7] = [
        Categoria::NaoCategorizado,
        Categoria::Biblias,
        Categoria::Infantil,
        Categoria::Familia,
        Categoria::Devocional,
        Categoria::EstudoTeologia,
        Categoria::Ficcao,
    ];

    pub fn de_i64(n: i64) -> Categoria {
        match n {
            1 => Categoria::Biblias,
            2 => Categoria::Infantil,
            3 => Categoria::Familia,
            4 => Categoria::Devocional,
            5 => Categoria::EstudoTeologia,
            6 => Categoria::Ficcao,
            _ => Categoria::NaoCategorizado, // 0 e desconhecidos
        }
    }

    /// Converte a categoria legada (texto livre) para o enum (FR-066):
    /// "0".."6" mapeiam direto; vazio/não-numérico ⇒ 0.
    pub fn de_legado(texto: &str) -> Categoria {
        match texto.trim().parse::<i64>() {
            Ok(n) => Categoria::de_i64(n),
            Err(_) => Categoria::NaoCategorizado,
        }
    }

    pub fn to_i64(self) -> i64 {
        self as i64
    }

    pub fn nome(self) -> &'static str {
        match self {
            Categoria::NaoCategorizado => "Não Categorizado",
            Categoria::Biblias => "Bíblias",
            Categoria::Infantil => "Infantil",
            Categoria::Familia => "Família",
            Categoria::Devocional => "Devocional",
            Categoria::EstudoTeologia => "Estudo & Teologia",
            Categoria::Ficcao => "Ficção",
        }
    }
}

impl From<Categoria> for i64 {
    fn from(c: Categoria) -> i64 {
        c.to_i64()
    }
}

impl TryFrom<i64> for Categoria {
    type Error = std::convert::Infallible;
    fn try_from(n: i64) -> Result<Categoria, Self::Error> {
        Ok(Categoria::de_i64(n))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn de_i64_mapeia_e_faz_fallback() {
        assert_eq!(Categoria::de_i64(1), Categoria::Biblias);
        assert_eq!(Categoria::de_i64(6), Categoria::Ficcao);
        assert_eq!(Categoria::de_i64(99), Categoria::NaoCategorizado);
        assert_eq!(Categoria::de_i64(0), Categoria::NaoCategorizado);
    }

    #[test]
    fn de_legado_sane_dados_sujos() {
        assert_eq!(Categoria::de_legado("5"), Categoria::EstudoTeologia);
        assert_eq!(Categoria::de_legado(" 2 "), Categoria::Infantil);
        assert_eq!(Categoria::de_legado("TYLER STATON"), Categoria::NaoCategorizado);
        assert_eq!(Categoria::de_legado(""), Categoria::NaoCategorizado);
        assert_eq!(Categoria::de_legado("PIBPenha"), Categoria::NaoCategorizado);
    }

    #[test]
    fn nome_e_indice() {
        assert_eq!(Categoria::NaoCategorizado.to_i64(), 0);
        assert_eq!(Categoria::Ficcao.to_i64(), 6);
        assert_eq!(Categoria::Biblias.nome(), "Bíblias");
    }
}
