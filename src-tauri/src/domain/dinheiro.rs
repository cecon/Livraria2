//! Valor monetário como inteiro de centavos (ADR-0005).
//! Nunca usar float para dinheiro — evita erro de arredondamento (SC-004).

use std::fmt;

/// Erro ao interpretar uma string monetária pt-BR.
#[derive(Debug, PartialEq, Eq, thiserror::Error)]
pub enum ErroDinheiro {
    #[error("valor monetário vazio")]
    Vazio,
    #[error("valor monetário inválido: {0:?}")]
    Invalido(String),
}

/// Quantia em centavos. `1.234,56` ⇒ `Dinheiro(123456)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default)]
pub struct Dinheiro(i64);

impl Dinheiro {
    pub const ZERO: Dinheiro = Dinheiro(0);

    pub const fn de_centavos(centavos: i64) -> Self {
        Dinheiro(centavos)
    }

    pub const fn centavos(self) -> i64 {
        self.0
    }

    pub fn soma(self, outro: Dinheiro) -> Dinheiro {
        Dinheiro(self.0 + outro.0)
    }

    /// Diferença com piso em zero (ex.: restante = max(0, total - pago)).
    pub fn diferenca_piso_zero(self, subtraendo: Dinheiro) -> Dinheiro {
        Dinheiro((self.0 - subtraendo.0).max(0))
    }

    /// Interpreta entrada pt-BR de UI: `.` = milhar, `,` = decimal.
    /// Aceita `R$`, espaços e sinal negativo. Ex.: "R$ 1.234,56", "30", "30,5".
    pub fn parse_brl(entrada: &str) -> Result<Dinheiro, ErroDinheiro> {
        let mut s: String = entrada.chars().filter(|c| !c.is_whitespace()).collect();
        for prefixo in ["R$", "r$", "$"] {
            if let Some(resto) = s.strip_prefix(prefixo) {
                s = resto.to_string();
            }
        }
        if s.is_empty() {
            return Err(ErroDinheiro::Vazio);
        }
        let negativo = s.starts_with('-');
        if negativo {
            s.remove(0);
        }
        // remove separadores de milhar e usa ',' como decimal
        let s = s.replace('.', "").replace(',', ".");
        let (inteiro, fracao) = match s.split_once('.') {
            Some((i, f)) => (i, f),
            None => (s.as_str(), ""),
        };
        if inteiro.is_empty() && fracao.is_empty() {
            return Err(ErroDinheiro::Invalido(entrada.to_string()));
        }
        let inteiro_val: i64 = if inteiro.is_empty() {
            0
        } else {
            inteiro
                .parse()
                .map_err(|_| ErroDinheiro::Invalido(entrada.to_string()))?
        };
        if !fracao.chars().all(|c| c.is_ascii_digit()) {
            return Err(ErroDinheiro::Invalido(entrada.to_string()));
        }
        let centavos_frac = centavos_da_fracao(fracao);
        let total = inteiro_val * 100 + centavos_frac;
        Ok(Dinheiro(if negativo { -total } else { total }))
    }

    /// Formata em pt-BR: `Dinheiro(123456)` ⇒ "R$ 1.234,56".
    pub fn to_brl(self) -> String {
        let neg = self.0 < 0;
        let abs = self.0.abs();
        let reais = abs / 100;
        let centavos = abs % 100;
        let mut grupos = String::new();
        let digitos = reais.to_string();
        let bytes = digitos.as_bytes();
        for (i, b) in bytes.iter().enumerate() {
            if i > 0 && (bytes.len() - i) % 3 == 0 {
                grupos.push('.');
            }
            grupos.push(*b as char);
        }
        format!("{}R$ {},{:02}", if neg { "-" } else { "" }, grupos, centavos)
    }
}

/// Converte a parte fracionária (string de dígitos) em centavos, arredondando
/// o terceiro dígito. "5" -> 50, "567" -> 57 (5,67 -> 57), "999" -> 100 (carry tratado fora? não):
/// retorna 0..=100; o carry de 100 é absorvido pelo chamador via soma normal.
fn centavos_da_fracao(fracao: &str) -> i64 {
    if fracao.is_empty() {
        return 0;
    }
    let mut dois = String::new();
    for (i, c) in fracao.chars().enumerate() {
        if i < 2 {
            dois.push(c);
        }
    }
    while dois.len() < 2 {
        dois.push('0');
    }
    let mut val: i64 = dois.parse().unwrap_or(0);
    if let Some(terceiro) = fracao.chars().nth(2) {
        if terceiro.is_ascii_digit() && terceiro as u8 - b'0' >= 5 {
            val += 1;
        }
    }
    val
}

impl fmt::Display for Dinheiro {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_brl())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_basico() {
        assert_eq!(Dinheiro::parse_brl("30").unwrap().centavos(), 3000);
        assert_eq!(Dinheiro::parse_brl("30,00").unwrap().centavos(), 3000);
        assert_eq!(Dinheiro::parse_brl("30,5").unwrap().centavos(), 3050);
        assert_eq!(Dinheiro::parse_brl("R$ 1.234,56").unwrap().centavos(), 123456);
        assert_eq!(Dinheiro::parse_brl("0,99").unwrap().centavos(), 99);
    }

    #[test]
    fn parse_arredonda_terceiro_decimal() {
        assert_eq!(Dinheiro::parse_brl("30,567").unwrap().centavos(), 3057);
        assert_eq!(Dinheiro::parse_brl("30,564").unwrap().centavos(), 3056);
    }

    #[test]
    fn parse_invalido() {
        assert_eq!(Dinheiro::parse_brl("   "), Err(ErroDinheiro::Vazio));
        assert!(Dinheiro::parse_brl("abc").is_err());
    }

    #[test]
    fn formata_brl() {
        assert_eq!(Dinheiro::de_centavos(123456).to_brl(), "R$ 1.234,56");
        assert_eq!(Dinheiro::de_centavos(3000).to_brl(), "R$ 30,00");
        assert_eq!(Dinheiro::de_centavos(5).to_brl(), "R$ 0,05");
        assert_eq!(Dinheiro::de_centavos(1000000).to_brl(), "R$ 10.000,00");
    }

    #[test]
    fn aritmetica() {
        let a = Dinheiro::de_centavos(3000);
        let b = Dinheiro::de_centavos(1250);
        assert_eq!(a.soma(b).centavos(), 4250);
        assert_eq!(b.diferenca_piso_zero(a).centavos(), 0);
        assert_eq!(a.diferenca_piso_zero(b).centavos(), 1750);
    }

    #[test]
    fn ida_e_volta() {
        for c in [0, 5, 99, 100, 3000, 123456, 1000000] {
            let d = Dinheiro::de_centavos(c);
            assert_eq!(Dinheiro::parse_brl(&d.to_brl()).unwrap().centavos(), c);
        }
    }
}
