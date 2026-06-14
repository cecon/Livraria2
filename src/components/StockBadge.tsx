// Selo de estoque (FR-051): Esgotado (rose) · baixo (amber) · normal (emerald).

import { seloEstoque } from "@/lib/types";

export function StockBadge({ estoque }: { estoque: number }) {
  const selo = seloEstoque(estoque);
  const texto = selo === "esgotado" ? "Esgotado" : `Estoque ${estoque}`;
  const cor =
    selo === "esgotado"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
      : selo === "baixo"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${cor}`}>
      {texto}
    </span>
  );
}
