//! Formas de pagamento e turno (Constituição, Princípio VI — rótulos exatos do domínio).

use serde::{Deserialize, Serialize};

/// Formas de pagamento na ordem e rótulos exatos do negócio (FR-013).
/// Apenas registro gerencial — sem TEF/fiscal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FormaPagamento {
    Cartao,
    Dinheiro,
    Pix,
    Ministerio,
    ValePresente,
}

impl FormaPagamento {
    /// Ordem canônica exibida no PDV e nos relatórios.
    pub const ORDEM: [FormaPagamento; 5] = [
        FormaPagamento::Cartao,
        FormaPagamento::Dinheiro,
        FormaPagamento::Pix,
        FormaPagamento::Ministerio,
        FormaPagamento::ValePresente,
    ];

    pub fn rotulo(self) -> &'static str {
        match self {
            FormaPagamento::Cartao => "Cartão",
            FormaPagamento::Dinheiro => "Dinheiro",
            FormaPagamento::Pix => "PIX",
            FormaPagamento::Ministerio => "Ministério",
            FormaPagamento::ValePresente => "Vale Presente",
        }
    }

    /// Mapeia o código de método do legado (`vdmetodo`) para a forma (ADR-0006, T050).
    /// Valores desconhecidos caem em Dinheiro (default seguro, registrado na migração).
    pub fn de_legado_metodo(codigo: &str) -> FormaPagamento {
        match codigo.trim().to_uppercase().as_str() {
            "C" => FormaPagamento::Cartao,
            "P" => FormaPagamento::Pix,
            "M" => FormaPagamento::Ministerio,
            "V" => FormaPagamento::ValePresente,
            _ => FormaPagamento::Dinheiro, // "D" e desconhecidos
        }
    }
}

/// Turno derivado do horário de conclusão da venda (corte ~13h).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Turno {
    Manha,
    Tarde,
}

impl Turno {
    /// Manhã antes das 13h; tarde a partir daí.
    pub fn de_hora(hora: u32) -> Turno {
        if hora < 13 {
            Turno::Manha
        } else {
            Turno::Tarde
        }
    }

    pub fn rotulo(self) -> &'static str {
        match self {
            Turno::Manha => "Turma da Manhã",
            Turno::Tarde => "Turma da Tarde",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordem_e_rotulos_exatos() {
        let rotulos: Vec<&str> = FormaPagamento::ORDEM.iter().map(|f| f.rotulo()).collect();
        assert_eq!(
            rotulos,
            vec!["Cartão", "Dinheiro", "PIX", "Ministério", "Vale Presente"]
        );
    }

    #[test]
    fn metodo_legado() {
        assert_eq!(FormaPagamento::de_legado_metodo("C"), FormaPagamento::Cartao);
        assert_eq!(FormaPagamento::de_legado_metodo("d"), FormaPagamento::Dinheiro);
        assert_eq!(FormaPagamento::de_legado_metodo("?"), FormaPagamento::Dinheiro);
    }

    #[test]
    fn turno_por_hora() {
        assert_eq!(Turno::de_hora(9), Turno::Manha);
        assert_eq!(Turno::de_hora(12), Turno::Manha);
        assert_eq!(Turno::de_hora(13), Turno::Tarde);
        assert_eq!(Turno::de_hora(18), Turno::Tarde);
    }
}
