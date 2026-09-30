"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/interface/ui/table";

import { useEffect, useState } from "react";
import { extratoLivro, ROTULO_MOVIMENTO, type Movimento } from "@/lib/nuvem/movimentos";
import { reais } from "@/utils/texto";

export function ExtratoMovimentos({ livroUid, refresh }: { livroUid: string; refresh?: number }) {
  const [movs, setMovs] = useState<Movimento[]>([]);

  useEffect(() => {
    extratoLivro(livroUid, 50)
      .then(setMovs)
      .catch(() => setMovs([]));
  }, [livroUid, refresh]);

  if (movs.length === 0) return null;

  return (
    <div className="mt-5">
      <h2 className="mb-2 text-sm font-medium">Extrato de movimentação</h2>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="w-full text-sm">
          <TableHeader className="bg-muted/50 text-muted-foreground">
            <TableRow>
              <TableHead className="p-2 text-left font-medium">Tipo</TableHead>
              <TableHead className="p-2 text-left font-medium">Origem</TableHead>
              <TableHead className="p-2 text-right font-medium">Qtd</TableHead>
              <TableHead className="p-2 text-right font-medium">Saldo</TableHead>
              <TableHead className="p-2 text-right font-medium">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movs.map((m) => (
              <TableRow key={m.sync_uid} className="border-t">
                <TableCell className="p-2">{ROTULO_MOVIMENTO[m.tipo] ?? m.tipo}</TableCell>
                <TableCell className="text-muted-foreground p-2 text-xs">
                  {m.motivo ?? m.fornecedor ?? (m.referencia ? `Pedido ${m.referencia}` : "—")}
                  {m.custo_unit_centavos != null && ` · ${reais(m.custo_unit_centavos)}/un`}
                </TableCell>
                <TableCell className={`p-2 text-right font-mono ${m.qtd >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {m.qtd > 0 ? `+${m.qtd}` : m.qtd}
                </TableCell>
                <TableCell className="p-2 text-right font-mono">{m.saldoResultante}</TableCell>
                <TableCell className="text-muted-foreground p-2 text-right text-xs">
                  {m.criado_em.slice(0, 10).split("-").reverse().join("/")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
