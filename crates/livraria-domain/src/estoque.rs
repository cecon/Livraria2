//! Regras puras da razão de movimentos de estoque (ADR-0008/0009).
//! Sem UI, sem banco: custo médio ponderado, derivação de custo, ajuste não-negativo,
//! diferença de contagem. Dinheiro em centavos (ADR-0005).

use super::dinheiro::Dinheiro;
use super::erros::ErroDominio;

/// Tipo de um movimento de estoque. Persistido como texto estável.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TipoMovimento {
    SaldoInicial,
    Entrada,
    SaidaVenda,
    Ajuste,
    Contagem,
    Estorno,
}

impl TipoMovimento {
    pub fn as_str(self) -> &'static str {
        match self {
            TipoMovimento::SaldoInicial => "saldo_inicial",
            TipoMovimento::Entrada => "entrada",
            TipoMovimento::SaidaVenda => "saida_venda",
            TipoMovimento::Ajuste => "ajuste",
            TipoMovimento::Contagem => "contagem",
            TipoMovimento::Estorno => "estorno",
        }
    }

    pub fn de_str(s: &str) -> Option<TipoMovimento> {
        match s {
            "saldo_inicial" => Some(TipoMovimento::SaldoInicial),
            "entrada" => Some(TipoMovimento::Entrada),
            "saida_venda" => Some(TipoMovimento::SaidaVenda),
            "ajuste" => Some(TipoMovimento::Ajuste),
            "contagem" => Some(TipoMovimento::Contagem),
            "estorno" => Some(TipoMovimento::Estorno),
            _ => None,
        }
    }
}

/// Divisão inteira com arredondamento half-up (numer ≥ 0, denom > 0).
fn round_div(numer: i64, denom: i64) -> i64 {
    debug_assert!(denom > 0);
    (((numer as i128) * 2 + denom as i128) / (denom as i128 * 2)) as i64
}

/// Custo médio ponderado após uma entrada (ADR-0009).
/// `(estoque*medio + qtd*custo_unit) / (estoque + qtd)`, half-up em centavos.
pub fn custo_medio_apos_entrada(
    estoque: i64,
    medio: Dinheiro,
    qtd: i64,
    custo_unit: Dinheiro,
) -> Dinheiro {
    let denom = estoque + qtd;
    if denom <= 0 {
        return Dinheiro::ZERO;
    }
    let numer = estoque * medio.centavos() + qtd * custo_unit.centavos();
    Dinheiro::de_centavos(round_div(numer, denom))
}

/// Fold do ledger → `(saldo, custo_medio)` para recompor os derivados após uma
/// sincronização (ADR-0008/0009). Cada item é `(qtd, custo_unit_centavos)` na
/// ordem cronológica; `qtd < 0` são saídas. O custo médio só muda em **entrada**
/// (`qtd > 0` com custo informado); saídas apenas reduzem o saldo.
pub fn recompor_ledger(movimentos: &[(i64, Option<i64>)]) -> (i64, Dinheiro) {
    let mut saldo = 0i64;
    let mut medio = Dinheiro::ZERO;
    for &(qtd, custo) in movimentos {
        if qtd > 0 {
            if let Some(c) = custo {
                medio = custo_medio_apos_entrada(saldo, medio, qtd, Dinheiro::de_centavos(c));
            }
        }
        saldo += qtd;
    }
    (saldo, medio)
}

/// Deriva (custo_unitário, custo_total) em centavos a partir do que o usuário informou.
/// Informe `unit` OU `total` (FR-010a). Exige `qtd > 0`.
pub fn derivar_custos(
    total: Option<i64>,
    unit: Option<i64>,
    qtd: i64,
) -> Result<(i64, i64), ErroDominio> {
    if qtd <= 0 {
        return Err(ErroDominio::QuantidadeInvalida);
    }
    match (unit, total) {
        (Some(u), _) if u >= 0 => Ok((u, u * qtd)),
        (None, Some(t)) if t >= 0 => Ok((round_div(t, qtd), t)),
        _ => Err(ErroDominio::DadosInvalidos(
            "informe o custo unitário ou o total".into(),
        )),
    }
}

/// Aplica um ajuste de estoque; barra resultado negativo (FR-043).
pub fn aplicar_ajuste(estoque: i64, delta: i64) -> Result<i64, ErroDominio> {
    let resultado = estoque + delta;
    if resultado < 0 {
        return Err(ErroDominio::EstoqueNegativo);
    }
    Ok(resultado)
}

/// Diferença de uma contagem de inventário: `contado − sistema` (FR-027).
/// O estoque final passa a ser exatamente o valor contado.
pub fn diferenca_contagem(sistema: i64, contado: i64) -> i64 {
    contado - sistema
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recompor_ledger_saldo_e_custo_medio() {
        // entrada 10 @ 100, entrada 10 @ 200 → médio 150, saldo 20; saída -5 → saldo 15, médio mantém.
        let movs = [(10_i64, Some(100_i64)), (10, Some(200)), (-5, None)];
        let (saldo, medio) = recompor_ledger(&movs);
        assert_eq!(saldo, 15);
        assert_eq!(medio.centavos(), 150);
    }

    #[test]
    fn tipo_ida_e_volta() {
        for t in [
            TipoMovimento::SaldoInicial,
            TipoMovimento::Entrada,
            TipoMovimento::SaidaVenda,
            TipoMovimento::Ajuste,
            TipoMovimento::Contagem,
        ] {
            assert_eq!(TipoMovimento::de_str(t.as_str()), Some(t));
        }
        assert_eq!(TipoMovimento::de_str("xxx"), None);
    }

    #[test]
    fn custo_medio_exemplo_quickstart() {
        // estoque 4 @ custo 0, entra 10 @ 1250 -> (0 + 12500)/14 = 892,85 -> 893
        let medio = custo_medio_apos_entrada(4, Dinheiro::ZERO, 10, Dinheiro::de_centavos(1250));
        assert_eq!(medio.centavos(), 893);
    }

    #[test]
    fn custo_medio_pondera_estoque_existente() {
        // 10 @ 1000 + 10 @ 2000 = (10000 + 20000)/20 = 1500
        let medio =
            custo_medio_apos_entrada(10, Dinheiro::de_centavos(1000), 10, Dinheiro::de_centavos(2000));
        assert_eq!(medio.centavos(), 1500);
    }

    #[test]
    fn custo_medio_estoque_zero() {
        let medio = custo_medio_apos_entrada(0, Dinheiro::ZERO, 0, Dinheiro::de_centavos(500));
        assert_eq!(medio.centavos(), 0);
    }

    #[test]
    fn derivar_do_unitario() {
        assert_eq!(derivar_custos(None, Some(1250), 10), Ok((1250, 12500)));
    }

    #[test]
    fn derivar_do_total() {
        // total 12500 / 10 = 1250
        assert_eq!(derivar_custos(Some(12500), None, 10), Ok((1250, 12500)));
        // total 1000 / 3 = 333,33 -> 333 (half-up)
        assert_eq!(derivar_custos(Some(1000), None, 3).unwrap().0, 333);
        // total 1000 / 8 = 125 exato
        assert_eq!(derivar_custos(Some(1000), None, 8).unwrap().0, 125);
    }

    #[test]
    fn derivar_qtd_invalida() {
        assert_eq!(derivar_custos(Some(100), None, 0), Err(ErroDominio::QuantidadeInvalida));
    }

    #[test]
    fn derivar_sem_custo() {
        assert!(matches!(
            derivar_custos(None, None, 5),
            Err(ErroDominio::DadosInvalidos(_))
        ));
    }

    #[test]
    fn ajuste_barra_negativo() {
        assert_eq!(aplicar_ajuste(3, -2), Ok(1));
        assert_eq!(aplicar_ajuste(3, -3), Ok(0));
        assert_eq!(aplicar_ajuste(3, -5), Err(ErroDominio::EstoqueNegativo));
        assert_eq!(aplicar_ajuste(0, 3), Ok(3));
    }

    #[test]
    fn diferenca_de_contagem() {
        assert_eq!(diferenca_contagem(5, 4), -1);
        assert_eq!(diferenca_contagem(5, 8), 3);
        assert_eq!(diferenca_contagem(5, 5), 0);
    }
}
