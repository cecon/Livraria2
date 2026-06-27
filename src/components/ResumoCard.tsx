// Agregados de um inventário realizado (US3, FR-012): total, bateram, faltaram,
// sobraram e soma das diferenças.

import type { ResumoInventario } from "@/lib/types";

export function ResumoCard({ resumo }: { resumo: ResumoInventario }) {
  const soma =
    resumo.somaDiferencas > 0 ? `+${resumo.somaDiferencas}` : String(resumo.somaDiferencas);
  const itens: { rotulo: string; valor: string | number; cor?: string }[] = [
    { rotulo: "Inventariados", valor: resumo.total },
    { rotulo: "Bateram", valor: resumo.bateram },
    { rotulo: "Faltaram", valor: resumo.faltaram, cor: "text-red-600" },
    { rotulo: "Sobraram", valor: resumo.sobraram, cor: "text-emerald-600" },
    { rotulo: "Soma das dif.", valor: soma },
  ];
  return (
    <div className="grid grid-cols-5 gap-3">
      {itens.map((i) => (
        <div key={i.rotulo} className="bg-card rounded-xl border p-3 text-center">
          <div className="text-muted-foreground text-[10px] uppercase">{i.rotulo}</div>
          <div className={`mt-1 font-mono text-lg font-bold ${i.cor ?? ""}`}>{i.valor}</div>
        </div>
      ))}
    </div>
  );
}
