//! Ponte WASM do domínio (ADR-0019). Cada função apenas embrulha `livraria-domain`
//! — a regra é única e vive no domínio. Fronteira em `f64` (convenção "number de
//! centavos no TS"; evita BigInt); quantidades e centavos cabem com folga em 2^53.

use livraria_domain::dinheiro::Dinheiro;
use livraria_domain::estoque;
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Baixa efetiva de uma venda (ADR-0018): `min(qtd, saldo)`, nunca negativa.
#[wasm_bindgen]
pub fn clamp_baixa_venda(qtd: f64, saldo: f64) -> f64 {
    estoque::clamp_baixa_venda(qtd as i64, saldo as i64) as f64
}

/// Quantidade do `saldo_inicial` que completa o ledger (ADR-0017): `estoque − Σ`.
#[wasm_bindgen]
pub fn baseline_saldo_inicial(estoque_atual: f64, soma_movimentos: f64) -> f64 {
    estoque::baseline_saldo_inicial(estoque_atual as i64, soma_movimentos as i64) as f64
}

/// Diferença de contagem de inventário: `contado − sistema`.
#[wasm_bindgen]
pub fn diferenca_contagem(sistema: f64, contado: f64) -> f64 {
    estoque::diferenca_contagem(sistema as i64, contado as i64) as f64
}

/// Custo médio ponderado após uma entrada (centavos in/out).
#[wasm_bindgen]
pub fn custo_medio_apos_entrada(
    estoque_atual: f64,
    medio_centavos: f64,
    qtd: f64,
    custo_unit_centavos: f64,
) -> f64 {
    estoque::custo_medio_apos_entrada(
        estoque_atual as i64,
        Dinheiro::de_centavos(medio_centavos as i64),
        qtd as i64,
        Dinheiro::de_centavos(custo_unit_centavos as i64),
    )
    .centavos() as f64
}

#[derive(Serialize)]
struct SaldoCusto {
    saldo: f64,
    custo_medio_centavos: f64,
}

/// Fold do ledger (ADR-0009): recebe `[[qtd, custo|null], …]` e devolve
/// `{ saldo, custo_medio_centavos }`. Fonte única do custo médio no Escritório.
#[wasm_bindgen]
pub fn recompor_ledger(movimentos: JsValue) -> Result<JsValue, JsError> {
    let movs: Vec<(i64, Option<i64>)> =
        serde_wasm_bindgen::from_value(movimentos).map_err(|e| JsError::new(&e.to_string()))?;
    let (saldo, medio) = estoque::recompor_ledger(&movs);
    let out = SaldoCusto {
        saldo: saldo as f64,
        custo_medio_centavos: medio.centavos() as f64,
    };
    serde_wasm_bindgen::to_value(&out).map_err(|e| JsError::new(&e.to_string()))
}

/// Interpreta um valor pt-BR (`"R$ 12,50"`) em centavos.
#[wasm_bindgen]
pub fn parse_brl(entrada: &str) -> Result<f64, JsError> {
    Dinheiro::parse_brl(entrada)
        .map(|d| d.centavos() as f64)
        .map_err(|e| JsError::new(&e.to_string()))
}

/// Formata centavos como `R$ 1.234,56`.
#[wasm_bindgen]
pub fn to_brl(centavos: f64) -> String {
    Dinheiro::de_centavos(centavos as i64).to_brl()
}
