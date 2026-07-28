//! Regras puras do lançamento de nota de entrada (feature 003, ADR-0011).
//! Sem UI/banco. Reusa o custo médio/`derivar_custos` do módulo `estoque`.

use super::erros::ErroDominio;

/// Estado de uma nota de entrada.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatusLancamento {
    Rascunho,
    Finalizada,
}

impl StatusLancamento {
    pub fn as_str(self) -> &'static str {
        match self {
            StatusLancamento::Rascunho => "rascunho",
            StatusLancamento::Finalizada => "finalizada",
        }
    }
    pub fn de_str(s: &str) -> Option<StatusLancamento> {
        match s {
            "rascunho" => Some(StatusLancamento::Rascunho),
            "finalizada" => Some(StatusLancamento::Finalizada),
            _ => None,
        }
    }
}

/// Uma linha da nota (domínio).
#[derive(Debug, Clone, PartialEq)]
pub struct ItemLancamento {
    pub livro_codigo: String,
    pub qtd: i64,
    pub custo_unit_centavos: i64,
}

/// Subtotal de uma linha (centavos).
pub fn total_item(qtd: i64, custo_unit_centavos: i64) -> i64 {
    qtd * custo_unit_centavos
}

/// Total da nota = soma dos subtotais dos itens (centavos).
pub fn total_nota(itens: &[ItemLancamento]) -> i64 {
    itens.iter().map(|i| total_item(i.qtd, i.custo_unit_centavos)).sum()
}

/// Pode finalizar (dar entrada)? Exige rascunho, fornecedor e ≥1 item (FR-016/017).
pub fn pode_finalizar(
    status: StatusLancamento,
    tem_fornecedor: bool,
    num_itens: usize,
) -> Result<(), ErroDominio> {
    if status == StatusLancamento::Finalizada {
        return Err(ErroDominio::NotaFinalizada);
    }
    if !tem_fornecedor {
        return Err(ErroDominio::SemFornecedor);
    }
    if num_itens == 0 {
        return Err(ErroDominio::SemItens);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(qtd: i64, custo: i64) -> ItemLancamento {
        ItemLancamento {
            livro_codigo: "111".into(),
            qtd,
            custo_unit_centavos: custo,
        }
    }

    #[test]
    fn status_ida_e_volta() {
        assert_eq!(StatusLancamento::de_str("rascunho"), Some(StatusLancamento::Rascunho));
        assert_eq!(StatusLancamento::de_str("finalizada"), Some(StatusLancamento::Finalizada));
        assert_eq!(StatusLancamento::de_str("x"), None);
        assert_eq!(StatusLancamento::Finalizada.as_str(), "finalizada");
    }

    #[test]
    fn totais() {
        assert_eq!(total_item(10, 1250), 12500);
        let itens = vec![item(10, 1250), item(2, 3000)];
        assert_eq!(total_nota(&itens), 12500 + 6000);
        assert_eq!(total_nota(&[]), 0);
    }

    #[test]
    fn finalizar_exige_fornecedor_e_itens() {
        assert_eq!(pode_finalizar(StatusLancamento::Rascunho, true, 2), Ok(()));
        assert_eq!(
            pode_finalizar(StatusLancamento::Rascunho, false, 2),
            Err(ErroDominio::SemFornecedor)
        );
        assert_eq!(
            pode_finalizar(StatusLancamento::Rascunho, true, 0),
            Err(ErroDominio::SemItens)
        );
        assert_eq!(
            pode_finalizar(StatusLancamento::Finalizada, true, 2),
            Err(ErroDominio::NotaFinalizada)
        );
    }
}
