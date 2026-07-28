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

    #[error("o ajuste deixaria o estoque negativo")]
    EstoqueNegativo,

    #[error("motivo obrigatório")]
    MotivoObrigatorio,

    #[error("nome obrigatório")]
    NomeObrigatorio,

    #[error("já existe um fornecedor com esse nome")]
    FornecedorDuplicado,

    #[error("a nota precisa de um fornecedor")]
    SemFornecedor,

    #[error("a nota já foi finalizada")]
    NotaFinalizada,

    #[error("forma de pagamento não encontrada")]
    FormaNaoEncontrada,

    #[error("forma de pagamento inativa não pode receber valores")]
    FormaInativa,

    #[error("forma de sistema não pode ser excluída nem desativada")]
    FormaDeSistema,

    #[error("forma já usada em vendas não pode ser excluída — desative-a")]
    FormaEmUso,

    #[error("não é possível desativar a última forma ativa")]
    UltimaFormaAtiva,

    #[error("já existe uma forma ativa com esse nome — renomeie antes")]
    FormaNomeDuplicado,

    #[error("destinação não encontrada")]
    DestinacaoNaoEncontrada,

    #[error("a Loja é a destinação padrão do sistema e não pode ser excluída, desativada ou reordenada")]
    DestinacaoDeSistema,

    #[error("destinação já usada não pode ser excluída — desative-a")]
    DestinacaoEmUso,

    #[error("já existe uma destinação ativa com esse nome — renomeie antes")]
    DestinacaoNomeDuplicado,

    #[error("destinação inativa não pode receber transferências")]
    DestinacaoInativa,

    #[error("origem e destino da transferência devem ser diferentes")]
    TransferenciaInvalida,

    #[error("saldo insuficiente na origem: disponível {disponivel}")]
    SaldoInsuficiente { disponivel: i64 },

    #[error("venda com mais de {dias} dias não pode mais ser cancelada")]
    VendaAntiga { dias: i64 },

    #[error("já existe um turno aberto — encerre-o antes de abrir outro")]
    TurnoJaAberto,

    #[error("é preciso abrir um turno antes de registrar vendas")]
    VendaSemTurno,
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
            ErroDominio::EstoqueNegativo => "ESTOQUE_NEGATIVO",
            ErroDominio::MotivoObrigatorio => "MOTIVO_OBRIGATORIO",
            ErroDominio::NomeObrigatorio => "NOME_OBRIGATORIO",
            ErroDominio::FornecedorDuplicado => "FORNECEDOR_DUPLICADO",
            ErroDominio::SemFornecedor => "SEM_FORNECEDOR",
            ErroDominio::NotaFinalizada => "NOTA_FINALIZADA",
            ErroDominio::FormaNaoEncontrada => "FORMA_NAO_ENCONTRADA",
            ErroDominio::FormaInativa => "FORMA_INATIVA",
            ErroDominio::FormaDeSistema => "FORMA_DE_SISTEMA",
            ErroDominio::FormaEmUso => "FORMA_EM_USO",
            ErroDominio::UltimaFormaAtiva => "ULTIMA_FORMA_ATIVA",
            ErroDominio::FormaNomeDuplicado => "FORMA_NOME_DUPLICADO",
            ErroDominio::DestinacaoNaoEncontrada => "DESTINACAO_NAO_ENCONTRADA",
            ErroDominio::DestinacaoDeSistema => "DESTINACAO_DE_SISTEMA",
            ErroDominio::DestinacaoEmUso => "DESTINACAO_EM_USO",
            ErroDominio::DestinacaoNomeDuplicado => "DESTINACAO_NOME_DUPLICADO",
            ErroDominio::DestinacaoInativa => "DESTINACAO_INATIVA",
            ErroDominio::TransferenciaInvalida => "TRANSFERENCIA_INVALIDA",
            ErroDominio::SaldoInsuficiente { .. } => "SALDO_INSUFICIENTE",
            ErroDominio::VendaAntiga { .. } => "VENDA_ANTIGA",
            ErroDominio::TurnoJaAberto => "TURNO_JA_ABERTO",
            ErroDominio::VendaSemTurno => "VENDA_SEM_TURNO",
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
