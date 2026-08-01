//! Regras puras da razão de movimentos de estoque (ADR-0008/0009).
//! Sem UI, sem banco: custo médio ponderado, fold do ledger, diferença de
//! contagem, baseline de saldo inicial. Dinheiro em centavos (ADR-0005).

use super::dinheiro::Dinheiro;

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

/// Diferença de uma contagem de inventário: `contado − sistema` (FR-027).
/// O estoque final passa a ser exatamente o valor contado.
pub fn diferenca_contagem(sistema: i64, contado: i64) -> i64 {
    contado - sistema
}

/// Baixa efetiva de uma venda (ADR-0018): nunca excede o saldo, nunca negativa.
/// Regra única PDV↔nuvem — se `baixa < qtd`, houve estoque insuficiente (drift a sinalizar).
pub fn clamp_baixa_venda(qtd: i64, saldo: i64) -> i64 {
    qtd.min(saldo).max(0)
}

/// Quantidade do movimento `saldo_inicial` que completa o ledger (ADR-0017):
/// `estoque − Σ movimentos`, garantindo `Σ == estoque` sem alterar o cache.
pub fn baseline_saldo_inicial(estoque: i64, soma_movimentos: i64) -> i64 {
    estoque - soma_movimentos
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
    fn diferenca_de_contagem() {
        assert_eq!(diferenca_contagem(5, 4), -1);
        assert_eq!(diferenca_contagem(5, 8), 3);
        assert_eq!(diferenca_contagem(5, 5), 0);
    }

    #[test]
    fn clamp_baixa_limita_ao_saldo_e_ao_piso() {
        assert_eq!(clamp_baixa_venda(3, 10), 3); // saldo suficiente
        assert_eq!(clamp_baixa_venda(5, 2), 2); // limita ao saldo (drift)
        assert_eq!(clamp_baixa_venda(4, 0), 0); // sem estoque
        assert_eq!(clamp_baixa_venda(4, -5), 0); // saldo negativo → piso 0
    }

    #[test]
    fn baseline_completa_o_ledger() {
        assert_eq!(baseline_saldo_inicial(10, 0), 10); // sem movimentos → estoque
        assert_eq!(baseline_saldo_inicial(10, 4), 6); // 10 − Σ(4)
        assert_eq!(baseline_saldo_inicial(0, -61), 61); // legado com Σ negativo (ex.: A PONTE)
        assert_eq!(baseline_saldo_inicial(5, 5), 0); // já completo
    }
}
