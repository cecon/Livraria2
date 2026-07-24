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

// Entrada estilo **maquininha** (paridade com o PDV): só os dígitos contam e as
// duas casas decimais entram da direita para a esquerda. "4500" → 4500 centavos.
export function digitosParaCentavos(entrada: string): number {
  const d = entrada.replace(/\D/g, "");
  return d ? parseInt(d, 10) : 0;
}

// Centavos → "1.234,56" (sem símbolo, para preencher o input da maquininha).
export function valorPos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
