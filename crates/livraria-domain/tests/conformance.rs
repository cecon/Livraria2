//! Lado NATIVO do teste de conformidade (ADR-0022). Roda os mesmos vetores que o
//! `@livraria/domain` (WASM) roda em `conformance.mjs`: mesma entrada → mesma saída.
//! Se ambos passam sobre os mesmos vetores, PDV (nativo) e Escritório (WASM) são idênticos.

use livraria_domain::pagamento::Turno;
use livraria_domain::pedido::{ItemPedido, Pedido, Recebimento};
use livraria_domain::{dinheiro::Dinheiro, estoque, turno_operacao};
use serde_json::Value;

// Monta um Pedido a partir dos pares [preco,qtd] e [forma,valor] do vetor.
fn pedido_do_vetor(c: &Value) -> Pedido {
    let itens = c["itens"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| ItemPedido {
            codigo: String::new(),
            titulo: String::new(),
            preco: Dinheiro::de_centavos(i(&p[0])),
            qtd: i(&p[1]),
        })
        .collect();
    let pagamentos = c["pagamentos"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| Recebimento { forma_id: i(&p[0]), valor: Dinheiro::de_centavos(i(&p[1])) })
        .collect();
    Pedido { numero: 0, cliente: String::new(), turno: Turno::Manha, data: String::new(), itens, pagamentos, operador: None }
}

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
    // Turno de operação (feature 009): numeração por turno e fechamento de caixa.
    for c in casos(&v, "turno_proximo_numero") {
        assert_eq!(turno_operacao::proximo_numero(i(&c["in"])), i(&c["out"]));
    }
    for c in casos(&v, "turno_encerrar") {
        let f = turno_operacao::encerrar(
            Dinheiro::de_centavos(i(&c["in"][0])),
            Dinheiro::de_centavos(i(&c["in"][1])),
        );
        assert_eq!(f.diferenca, i(&c["out"]));
    }
    // Venda (feature 009): troco pelas mesmas regras do PDV.
    for c in casos(&v, "troco_venda") {
        assert_eq!(pedido_do_vetor(c).troco().centavos(), i(&c["out"]));
    }
}
