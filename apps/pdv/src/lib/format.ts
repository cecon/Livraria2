// Utilidades de formatação pt-BR (FR-050) e normalização de busca (FR-021).
// Dinheiro trafega em centavos (i64 no Rust) — formatar só na borda.

/** Centavos -> "R$ 1.234,56". */
export function brl(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Centavos -> "1234,56" (sem símbolo, para preencher inputs). */
export function centavosParaInput(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/** Centavos -> "1.500,00" (estilo maquininha, com milhar). */
export function valorPos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Só os dígitos digitados viram centavos (POS: dois últimos = decimais). */
export function digitosParaCentavos(entrada: string): number {
  const d = entrada.replace(/\D/g, "");
  return d ? parseInt(d, 10) : 0;
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
