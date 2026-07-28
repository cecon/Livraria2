//! Ponte WASM do domínio (ADR-0022). Cada função apenas embrulha `livraria-domain`
//! — a regra é única e vive no domínio. Fronteira em `f64` (convenção "number de
//! centavos no TS"; evita BigInt); quantidades e centavos cabem com folga em 2^53.

use livraria_domain::dinheiro::Dinheiro;
use livraria_domain::pagamento::Turno;
use livraria_domain::pedido::{ItemPedido, Pedido, Recebimento};
use livraria_domain::{estoque, inventario, turno_operacao};
use serde::{Deserialize, Serialize};
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

// ---------------------------------------------------------------------------
// Venda (ADR-0022): validação de conclusão e troco — regra em `pedido.rs`.
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct ItemIn {
    #[serde(rename = "precoCentavos")]
    preco_centavos: i64,
    qtd: i64,
}

#[derive(Deserialize)]
struct PagIn {
    #[serde(rename = "formaId")]
    forma_id: i64,
    #[serde(rename = "valorCentavos")]
    valor_centavos: i64,
}

/// Monta um `Pedido` mínimo (só o necessário para total/pago) a partir das
/// entradas do checkout. Campos identitários são irrelevantes para as regras.
fn montar_pedido(itens: Vec<ItemIn>, pagamentos: Vec<PagIn>) -> Pedido {
    Pedido {
        numero: 0,
        cliente: String::new(),
        turno: Turno::Manha,
        data: String::new(),
        operador: None,
        itens: itens
            .into_iter()
            .map(|i| ItemPedido {
                codigo: String::new(),
                titulo: String::new(),
                preco: Dinheiro::de_centavos(i.preco_centavos),
                qtd: i.qtd,
            })
            .collect(),
        pagamentos: pagamentos
            .into_iter()
            .map(|p| Recebimento {
                forma_id: p.forma_id,
                valor: Dinheiro::de_centavos(p.valor_centavos),
            })
            .collect(),
    }
}

fn ler<T: for<'de> Deserialize<'de>>(js: JsValue) -> Result<T, JsError> {
    serde_wasm_bindgen::from_value(js).map_err(|e| JsError::new(&e.to_string()))
}

fn escrever<T: Serialize>(v: &T) -> Result<JsValue, JsError> {
    serde_wasm_bindgen::to_value(v).map_err(|e| JsError::new(&e.to_string()))
}

#[derive(Serialize)]
struct ValidacaoOut {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    erro: Option<String>,
    #[serde(rename = "faltaCentavos", skip_serializing_if = "Option::is_none")]
    falta_centavos: Option<i64>,
}

/// Valida a conclusão da venda (≥1 item, pago ≥ total, troco só do dinheiro).
#[wasm_bindgen]
pub fn validar_conclusao_venda(itens: JsValue, pagamentos: JsValue, dinheiro_forma_id: f64) -> Result<JsValue, JsError> {
    use livraria_domain::erros::ErroDominio;
    let pedido = montar_pedido(ler(itens)?, ler(pagamentos)?);
    let out = match pedido.validar_conclusao(dinheiro_forma_id as i64) {
        Ok(()) => ValidacaoOut { ok: true, erro: None, falta_centavos: None },
        Err(ErroDominio::SemItens) => ValidacaoOut { ok: false, erro: Some("SEM_ITENS".into()), falta_centavos: None },
        Err(ErroDominio::PagoInsuficiente { falta_centavos }) => ValidacaoOut {
            ok: false,
            erro: Some("PAGO_INSUFICIENTE".into()),
            falta_centavos: Some(falta_centavos),
        },
        Err(ErroDominio::TrocoSemDinheiro) => ValidacaoOut { ok: false, erro: Some("TROCO_SEM_DINHEIRO".into()), falta_centavos: None },
        Err(_) => ValidacaoOut { ok: false, erro: Some("INVALIDO".into()), falta_centavos: None },
    };
    escrever(&out)
}

/// Troco da venda (centavos; 0 se pago ≤ total).
#[wasm_bindgen]
pub fn troco_venda(itens: JsValue, pagamentos: JsValue) -> Result<f64, JsError> {
    Ok(montar_pedido(ler(itens)?, ler(pagamentos)?).troco().centavos() as f64)
}

/// Restante a receber (centavos; 0 se pago ≥ total).
#[wasm_bindgen]
pub fn restante_venda(itens: JsValue, pagamentos: JsValue) -> Result<f64, JsError> {
    Ok(montar_pedido(ler(itens)?, ler(pagamentos)?).restante().centavos() as f64)
}

// ---------------------------------------------------------------------------
// Turno de operação (ADR-0021) — regra em `turno_operacao.rs`.
// ---------------------------------------------------------------------------

/// Uma venda só pode ser registrada num turno "aberto".
#[wasm_bindgen]
pub fn turno_pode_registrar_venda(status: &str) -> bool {
    turno_operacao::pode_registrar_venda(turno_operacao::StatusTurno::de_str(status))
}

/// Próximo Pedido Nº do turno (1..n).
#[wasm_bindgen]
pub fn turno_proximo_numero(qtd_no_turno: f64) -> f64 {
    turno_operacao::proximo_numero(qtd_no_turno as i64) as f64
}

#[derive(Serialize)]
struct PorForma {
    #[serde(rename = "formaId")]
    forma_id: i64,
    centavos: i64,
}

#[derive(Serialize)]
struct ResumoCaixaOut {
    #[serde(rename = "qtdVendas")]
    qtd_vendas: i64,
    #[serde(rename = "porForma")]
    por_forma: Vec<PorForma>,
    #[serde(rename = "esperadoDinheiroCentavos")]
    esperado_dinheiro_centavos: i64,
}

/// Resume o fechamento: totais por forma (informativos) + esperado só do dinheiro.
#[wasm_bindgen]
pub fn turno_resumir_fechamento(
    pagamentos_do_turno: JsValue,
    caixa_inicial_centavos: f64,
    dinheiro_forma_id: f64,
    qtd_vendas: f64,
) -> Result<JsValue, JsError> {
    let pags: Vec<PagIn> = ler(pagamentos_do_turno)?;
    let recebimentos: Vec<Recebimento> = pags
        .into_iter()
        .map(|p| Recebimento { forma_id: p.forma_id, valor: Dinheiro::de_centavos(p.valor_centavos) })
        .collect();
    let resumo = turno_operacao::resumir_fechamento(
        &recebimentos,
        Dinheiro::de_centavos(caixa_inicial_centavos as i64),
        dinheiro_forma_id as i64,
        qtd_vendas as i64,
    );
    let out = ResumoCaixaOut {
        qtd_vendas: resumo.qtd_vendas,
        por_forma: resumo
            .por_forma
            .into_iter()
            .map(|(forma_id, d)| PorForma { forma_id, centavos: d.centavos() })
            .collect(),
        esperado_dinheiro_centavos: resumo.esperado_dinheiro.centavos(),
    };
    escrever(&out)
}

#[derive(Serialize)]
struct FechamentoOut {
    #[serde(rename = "esperadoCentavos")]
    esperado_centavos: i64,
    #[serde(rename = "conferidoCentavos")]
    conferido_centavos: i64,
    #[serde(rename = "diferencaCentavos")]
    diferenca_centavos: i64,
}

/// Fechamento de caixa: diferença = conferido − esperado (pode ser < 0).
#[wasm_bindgen]
pub fn turno_encerrar(esperado_dinheiro_centavos: f64, conferido_dinheiro_centavos: f64) -> Result<JsValue, JsError> {
    let f = turno_operacao::encerrar(
        Dinheiro::de_centavos(esperado_dinheiro_centavos as i64),
        Dinheiro::de_centavos(conferido_dinheiro_centavos as i64),
    );
    escrever(&FechamentoOut {
        esperado_centavos: f.esperado.centavos(),
        conferido_centavos: f.conferido.centavos(),
        diferenca_centavos: f.diferenca,
    })
}

// ---------------------------------------------------------------------------
// Inventário (ADR-0010) — regra em `inventario.rs`.
// ---------------------------------------------------------------------------

/// Contagem efetiva no fechamento: parcial só ajusta contados; total zera
/// não-contados. `tem_contada=false` significa livro não contado.
#[wasm_bindgen]
pub fn contagem_efetiva(modo: &str, contada: f64, tem_contada: bool) -> Result<JsValue, JsError> {
    let m = inventario::ModoInventario::de_str(modo).unwrap_or(inventario::ModoInventario::Parcial);
    let entrada = if tem_contada { Some(contada as i64) } else { None };
    let efetiva: Option<i64> = inventario::contagem_efetiva(m, entrada);
    escrever(&efetiva)
}

#[derive(Serialize)]
struct ResumoInventarioOut {
    total: i64,
    bateram: i64,
    faltaram: i64,
    sobraram: i64,
    #[serde(rename = "somaDiferencas")]
    soma_diferencas: i64,
}

/// Resume os itens contados `[[sistema, contado], …]`.
#[wasm_bindgen]
pub fn resumir(itens: JsValue) -> Result<JsValue, JsError> {
    let pares: Vec<(i64, i64)> = ler(itens)?;
    let r = inventario::resumir(&pares);
    escrever(&ResumoInventarioOut {
        total: r.total,
        bateram: r.bateram,
        faltaram: r.faltaram,
        sobraram: r.sobraram,
        soma_diferencas: r.soma_diferencas,
    })
}
