// Ajuste manual de estoque (spec 015): a quantidade só vale se for um inteiro exato
// com sinal opcional ("-2", "+3"). parseInt aceitaria "2,5" como 2 e "-2abc" como -2.
export function lerQtdAjuste(texto: string): number | null {
  const t = texto.trim();
  if (!/^[+-]?\d+$/.test(t)) return null;
  const n = Number(t);
  return n === 0 || !Number.isSafeInteger(n) ? null : n;
}
