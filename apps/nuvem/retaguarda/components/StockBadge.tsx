// Selo de estoque (FR-051) — mesma regra/aparência do PDV.
function selo(estoque: number): "esgotado" | "baixo" | "normal" {
  if (estoque <= 0) return "esgotado";
  if (estoque <= 3) return "baixo";
  return "normal";
}

export function StockBadge({ estoque }: { estoque: number }) {
  const s = selo(estoque);
  const texto = s === "esgotado" ? "Esgotado" : `Estoque ${estoque}`;
  const cor =
    s === "esgotado"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
      : s === "baixo"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${cor}`}>{texto}</span>
  );
}
