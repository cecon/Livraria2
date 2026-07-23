//! Lado NATIVO do teste de conformidade (ADR-0022). Roda os mesmos vetores que o
//! `@livraria/domain` (WASM) roda em `conformance.mjs`: mesma entrada → mesma saída.
//! Se ambos passam sobre os mesmos vetores, PDV (nativo) e Escritório (WASM) são idênticos.

use livraria_domain::{dinheiro::Dinheiro, estoque};
use serde_json::Value;

const VECTORS: &str =
    include_str!("../../../specs/008-escritorio-espelho-pdv/contracts/conformance-vectors.json");

fn casos<'a>(v: &'a Value, chave: &str) -> &'a Vec<Value> {
    v[chave].as_array().unwrap()
}

fn i(v: &Value) -> i64 {
    v.as_i64().unwrap()
}

#[test]
fn conformidade_nativa() {
    let v: Value = serde_json::from_str(VECTORS).unwrap();

    for c in casos(&v, "clamp_baixa_venda") {
        assert_eq!(estoque::clamp_baixa_venda(i(&c["in"][0]), i(&c["in"][1])), i(&c["out"]));
    }
    for c in casos(&v, "baseline_saldo_inicial") {
        assert_eq!(estoque::baseline_saldo_inicial(i(&c["in"][0]), i(&c["in"][1])), i(&c["out"]));
    }
    for c in casos(&v, "diferenca_contagem") {
        assert_eq!(estoque::diferenca_contagem(i(&c["in"][0]), i(&c["in"][1])), i(&c["out"]));
    }
    for c in casos(&v, "custo_medio_apos_entrada") {
        let got = estoque::custo_medio_apos_entrada(
            i(&c["in"][0]),
            Dinheiro::de_centavos(i(&c["in"][1])),
            i(&c["in"][2]),
            Dinheiro::de_centavos(i(&c["in"][3])),
        )
        .centavos();
        assert_eq!(got, i(&c["out"]));
    }
    for c in casos(&v, "parse_brl") {
        let got = Dinheiro::parse_brl(c["in"].as_str().unwrap()).unwrap().centavos();
        assert_eq!(got, i(&c["out"]));
    }
    for c in casos(&v, "to_brl") {
        assert_eq!(Dinheiro::de_centavos(i(&c["in"])).to_brl(), c["out"].as_str().unwrap());
    }
    for c in casos(&v, "recompor_ledger") {
        let movs: Vec<(i64, Option<i64>)> = c["in"]
            .as_array()
            .unwrap()
            .iter()
            .map(|m| (i(&m[0]), if m[1].is_null() { None } else { Some(i(&m[1])) }))
            .collect();
        let (saldo, medio) = estoque::recompor_ledger(&movs);
        assert_eq!(saldo, i(&c["saldo"]));
        assert_eq!(medio.centavos(), i(&c["custo"]));
    }
}
