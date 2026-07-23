// Lado WASM do teste de conformidade (ADR-0019). Carrega @livraria/domain
// (packages/domain, gerado pelo CI) e roda os MESMOS vetores que o teste nativo
// (crates/livraria-domain/tests/conformance.rs). Node: `node conformance.mjs`.
import { readFileSync } from "node:fs";
import init, * as dom from "../../../packages/domain/index.js";

const bytes = readFileSync(new URL("../../../packages/domain/index_bg.wasm", import.meta.url));
await init({ module_or_path: bytes });

const vetores = JSON.parse(readFileSync(new URL("./conformance-vectors.json", import.meta.url)));

let falhas = 0;
const eq = (nome, obtido, esperado) => {
  const o = JSON.stringify(obtido);
  const e = JSON.stringify(esperado);
  if (o !== e) {
    console.error(`  ✗ ${nome}: obtido ${o}, esperado ${e}`);
    falhas++;
  }
};

for (const c of vetores.clamp_baixa_venda) eq("clamp_baixa_venda", dom.clamp_baixa_venda(...c.in), c.out);
for (const c of vetores.baseline_saldo_inicial) eq("baseline_saldo_inicial", dom.baseline_saldo_inicial(...c.in), c.out);
for (const c of vetores.diferenca_contagem) eq("diferenca_contagem", dom.diferenca_contagem(...c.in), c.out);
for (const c of vetores.custo_medio_apos_entrada) eq("custo_medio_apos_entrada", dom.custo_medio_apos_entrada(...c.in), c.out);
for (const c of vetores.parse_brl) eq("parse_brl", dom.parse_brl(c.in), c.out);
for (const c of vetores.to_brl) eq("to_brl", dom.to_brl(c.in), c.out);
for (const c of vetores.recompor_ledger) {
  const r = dom.recompor_ledger(c.in);
  eq("recompor_ledger.saldo", r.saldo, c.saldo);
  eq("recompor_ledger.custo", r.custo_medio_centavos, c.custo);
}
for (const c of vetores.turno_proximo_numero) eq("turno_proximo_numero", dom.turno_proximo_numero(c.in), c.out);
for (const c of vetores.turno_encerrar) eq("turno_encerrar", dom.turno_encerrar(...c.in).diferencaCentavos, c.out);
for (const c of vetores.troco_venda) {
  const itens = c.itens.map(([precoCentavos, qtd]) => ({ precoCentavos, qtd }));
  const pagamentos = c.pagamentos.map(([formaId, valorCentavos]) => ({ formaId, valorCentavos }));
  eq("troco_venda", dom.troco_venda(itens, pagamentos), c.out);
}
for (const c of vetores.contagem_efetiva) eq("contagem_efetiva", dom.contagem_efetiva(c.in[0], c.in[1], c.in[2]), c.out);
for (const c of vetores.resumir_inventario) eq("resumir_inventario", dom.resumir(c.in), c.out);

if (falhas > 0) {
  console.error(`\n${falhas} divergência(s) PDV↔WASM.`);
  process.exit(1);
}
console.log("✓ conformidade PDV↔WASM: todos os vetores conferem (nativo == WASM).");
