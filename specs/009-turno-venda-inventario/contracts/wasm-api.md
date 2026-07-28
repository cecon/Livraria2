# Contrato — API WASM adicionada (`@livraria/domain`)

Novos wrappers em `crates/livraria-domain-wasm/src/lib.rs`. Fronteira em `f64`/`JsValue` (convenção atual:
"number de centavos no TS"; evita BigInt). Cada wrapper apenas embrulha o domínio — **regra única**. O CI
(`.github/workflows/wasm.yml`) regenera `packages/domain` (build no CI por causa do Windows SAC).

## Já existentes (reuso, sem mudança)

`clamp_baixa_venda(qtd, saldo) -> number` · `diferenca_contagem(sistema, contado) -> number` ·
`recompor_ledger(movs) -> {saldo, custo_medio_centavos}` · `custo_medio_apos_entrada(...)` ·
`baseline_saldo_inicial(...)` · `parse_brl(str) -> number` · `to_brl(centavos) -> string`.

## Venda (expor validação + troco)

```ts
// itens: [{ precoCentavos:number, qtd:number }]  pagamentos: [{ formaId:number, valorCentavos:number }]
validar_conclusao_venda(itens: JsValue, pagamentos: JsValue, dinheiro_forma_id: number)
  -> { ok: true } | { ok: false, erro: "SEM_ITENS"|"PAGO_INSUFICIENTE"|"TROCO_SEM_DINHEIRO", faltaCentavos?: number }
troco_venda(itens: JsValue, pagamentos: JsValue) -> number      // centavos (0 se pago ≤ total)
restante_venda(itens: JsValue, pagamentos: JsValue) -> number   // centavos (0 se pago ≥ total)
```

Mapeia 1:1 para `Pedido::{validar_conclusao, troco, restante}`. Os erros espelham `ErroDominio`.

## Turno de operação

```ts
turno_pode_registrar_venda(status: string /* "aberto"|"encerrado" */) -> boolean
turno_proximo_numero(qtd_no_turno: number) -> number            // qtd + 1

// pagamentos_do_turno: [{ formaId:number, valorCentavos:number }] (todos os recebimentos do turno)
turno_resumir_fechamento(pagamentos_do_turno: JsValue, caixa_inicial_centavos: number, dinheiro_forma_id: number)
  -> { qtdVendas:number, porForma: [{formaId:number, centavos:number}], esperadoDinheiroCentavos:number }

turno_encerrar(esperado_dinheiro_centavos: number, conferido_dinheiro_centavos: number)
  -> { esperadoCentavos:number, conferidoCentavos:number, diferencaCentavos:number /* pode ser < 0 */ }
```

`turno_resumir_fechamento` computa o **esperado só do dinheiro** = `caixa_inicial + Σ recebido na forma
Dinheiro`; as demais formas voltam em `porForma` como informativos (clarify Q1).

## Conformidade (teste)

Para cada função nova, um caso em `crates/livraria-domain/tests/conformance.rs` prova **nativo == WASM** para o
mesmo input (SC-005). Já vale para clamp/custo/contagem; estende-se para venda e turno.
