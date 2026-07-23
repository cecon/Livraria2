"use client";

// Revisão da contagem (feature 009, US3) — divergências (saldo × contado) antes de
// aplicar os ajustes. Reconciliação já calculada pelo domínio (WASM).
import { Button } from "@livraria/ui/ui/button";
import type { Divergencia } from "@/lib/nuvem/inventario";

export function RevisaoContagem({
  divergencias,
  ocupado,
  onAplicar,
  onVoltar,
}: {
  divergencias: Divergencia[];
  ocupado: boolean;
  onAplicar: () => void;
  onVoltar: () => void;
}) {
  const comDiferenca = divergencias.filter((d) => d.diferenca !== 0);
  return (
    <div className="bg-card space-y-4 rounded-lg border p-4">
      <div className="text-sm font-medium">Revisão da contagem</div>
      {comDiferenca.length === 0 ? (
        <p className="text-muted-foreground text-sm">Tudo confere — nenhum ajuste a aplicar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                <th className="py-1">Item</th>
                <th className="py-1 text-right">Saldo</th>
                <th className="py-1 text-right">Contado</th>
                <th className="py-1 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {comDiferenca.map((d) => (
                <tr key={d.livroUid} className="border-b last:border-b-0">
                  <td className="py-1">
                    <div className="truncate">{d.titulo}</div>
                    <div className="text-muted-foreground font-mono text-[11px]">{d.codigo}</div>
                  </td>
                  <td className="py-1 text-right tabular-nums">{d.saldo}</td>
                  <td className="py-1 text-right tabular-nums">{d.efetiva}</td>
                  <td className={`py-1 text-right tabular-nums font-medium ${d.diferenca < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {d.diferenca > 0 ? `+${d.diferenca}` : d.diferenca}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={onAplicar} disabled={ocupado || comDiferenca.length === 0} className="h-9">
          Aplicar ajustes
        </Button>
        <Button variant="ghost" onClick={onVoltar} disabled={ocupado} className="h-9">
          Voltar
        </Button>
      </div>
    </div>
  );
}
