// Utilidades de formatação pt-BR (FR-050) e normalização de busca (FR-021).
// Dinheiro trafega em centavos (i64 no Rust) — formatar só na borda.

/** Centavos -> "R$ 1.234,56". */
export function brl(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** "1.234,56" | "30" | "R$ 30,5" -> centavos (inteiro). null se inválido. */
export function parseBrlParaCentavos(entrada: string): number | null {
  const limpo = entrada
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Remove acento e caixa para busca: "Bíblia" -> "biblia" (espelha domain::texto). */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase();
}
