"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/interface/ui/table";
import { Cover } from "./Cover";

// Revisão da contagem (feature 009, US3) — divergências (saldo × contado) antes de
// aplicar os ajustes. Reconciliação já calculada pelo domínio (WASM).
import { Button } from "@/interface/ui/button";
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
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="text-muted-foreground border-b text-left text-xs uppercase">
                <TableHead className="py-1">Item</TableHead>
                <TableHead className="py-1 text-right">Saldo</TableHead>
                <TableHead className="py-1 text-right">Contado</TableHead>
                <TableHead className="py-1 text-right">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comDiferenca.map((d) => (
                <TableRow key={d.livroUid} className="border-b last:border-b-0">
                  <TableCell className="py-1">
                    <div className="flex items-center gap-3"><Cover titulo={d.titulo} capaUid={d.capaUid} tamanho="sm" /><span className="truncate">{d.titulo}</span></div>
                    <div className="text-muted-foreground font-mono text-[11px]">{d.codigo}</div>
                  </TableCell>
                  <TableCell className="py-1 text-right tabular-nums">{d.saldo}</TableCell>
                  <TableCell className="py-1 text-right tabular-nums">{d.efetiva}</TableCell>
                  <TableCell className={`py-1 text-right tabular-nums font-medium ${d.diferenca < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {d.diferenca > 0 ? `+${d.diferenca}` : d.diferenca}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
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
