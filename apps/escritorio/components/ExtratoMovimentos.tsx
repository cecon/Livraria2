"use client";

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
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-2 text-left font-medium">Tipo</th>
              <th className="p-2 text-left font-medium">Origem</th>
              <th className="p-2 text-right font-medium">Qtd</th>
              <th className="p-2 text-right font-medium">Saldo</th>
              <th className="p-2 text-right font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {movs.map((m) => (
              <tr key={m.sync_uid} className="border-t">
                <td className="p-2">{ROTULO_MOVIMENTO[m.tipo] ?? m.tipo}</td>
                <td className="text-muted-foreground p-2 text-xs">
                  {m.motivo ?? m.fornecedor ?? (m.referencia ? `Pedido ${m.referencia}` : "—")}
                  {m.custo_unit_centavos != null && ` · ${reais(m.custo_unit_centavos)}/un`}
                </td>
                <td className={`p-2 text-right font-mono ${m.qtd >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {m.qtd > 0 ? `+${m.qtd}` : m.qtd}
                </td>
                <td className="p-2 text-right font-mono">{m.saldoResultante}</td>
                <td className="text-muted-foreground p-2 text-right text-xs">
                  {m.criado_em.slice(0, 10).split("-").reverse().join("/")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
