//! Erros de domínio com códigos estáveis (contratos Tauri — contracts/tauri-commands.md).

/// Erros das regras de negócio. O `codigo()` é estável e cruza a fronteira Tauri.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum ErroDominio {
    #[error("o pedido não tem itens")]
    SemItens,

    #[error("pagamento insuficiente: falta {falta_centavos} centavos")]
    PagoInsuficiente { falta_centavos: i64 },

    #[error("livro não encontrado")]
    LivroNaoEncontrado,

    #[error("código de barras inválido")]
    CodigoInvalido,

    #[error("quantidade inválida (mínimo 1)")]
    QuantidadeInvalida,

    #[error("dados inválidos: {0}")]
    DadosInvalidos(String),

    #[error("troco só pode sair do dinheiro recebido")]
    TrocoSemDinheiro,
}

impl ErroDominio {
    /// Código estável usado no DTO de erro (`{ codigo, mensagem }`).
    pub fn codigo(&self) -> &'static str {
        match self {
            ErroDominio::SemItens => "SEM_ITENS",
            ErroDominio::PagoInsuficiente { .. } => "PAGO_INSUFICIENTE",
            ErroDominio::LivroNaoEncontrado => "LIVRO_NAO_ENCONTRADO",
            ErroDominio::CodigoInvalido => "CODIGO_INVALIDO",
            ErroDominio::QuantidadeInvalida => "QUANTIDADE_INVALIDA",
            ErroDominio::DadosInvalidos(_) => "DADOS_INVALIDOS",
            ErroDominio::TrocoSemDinheiro => "TROCO_SEM_DINHEIRO",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codigos_estaveis() {
        assert_eq!(ErroDominio::SemItens.codigo(), "SEM_ITENS");
        assert_eq!(
            ErroDominio::PagoInsuficiente { falta_centavos: 50 }.codigo(),
            "PAGO_INSUFICIENTE"
        );
        assert_eq!(ErroDominio::CodigoInvalido.codigo(), "CODIGO_INVALIDO");
    }

    #[test]
    fn mensagem_inclui_falta() {
        let e = ErroDominio::PagoInsuficiente { falta_centavos: 1250 };
        assert!(e.to_string().contains("1250"));
    }
}
