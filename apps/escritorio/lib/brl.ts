// Formatação de exibição de dinheiro (apresentação — a REGRA de moeda-em-centavos
// vive no domínio). Equivale ao `to_brl` do WASM: `123456` → "R$ 1.234,56".
export function brl(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Interpreta a digitação pt-BR em centavos (entrada de UI): "1.234,56" → 123456.
// Presentação; a regra de moeda-em-centavos é do domínio.
export function parseBRLInput(entrada: string): number {
  const s = entrada.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
