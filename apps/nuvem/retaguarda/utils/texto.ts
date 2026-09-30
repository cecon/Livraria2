// Normalização de texto (sem acento, minúsculo, trim) — espelha a busca do PDV.
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// centavos a partir de "12,50" / "12.50" / "12".
export function centavos(txt: string): number {
  const n = parseFloat(String(txt).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// exibe centavos como R$ 12,34.
export function reais(cents: number): string {
  return "R$ " + (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
