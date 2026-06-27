// Lista de inventários realizados (US3, FR-010): sessões fechadas/canceladas.
// Selecionar abre o detalhe só-leitura (InventarioDetalhe).

import { useEffect, useState } from "react";
import { InventarioDetalhe } from "@/components/InventarioDetalhe";
import { inventarioRealizados } from "@/lib/ipc";
import type { Sessao } from "@/lib/types";

export function InventariosRealizados() {
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    inventarioRealizados()
      .then(setSessoes)
      .catch(() => setSessoes([]));
  }, []);

  if (sel !== null) {
    return (
      <div className="bg-card mt-4 rounded-xl border p-5">
        <InventarioDetalhe sessaoId={sel} onVoltar={() => setSel(null)} />
      </div>
    );
  }

  if (sessoes.length === 0) return null;

  return (
    <div className="bg-card mt-4 rounded-xl border p-5">
      <h2 className="font-medium">Inventários realizados</h2>
      <p className="text-muted-foreground text-xs">
        Toque para ver o resultado (somente leitura).
      </p>
      <ul className="mt-3 space-y-2">
        {sessoes.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => setSel(s.id)}
              className="hover:bg-muted/50 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm"
            >
              <span>
                <span className="font-medium">
                  {s.modo === "total" ? "Total" : "Parcial"}
                </span>
                {s.rotulo ? ` · ${s.rotulo}` : ""}
                <span
                  className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                    s.status === "cancelada"
                      ? "bg-muted text-muted-foreground"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {s.status}
                </span>
              </span>
              <span className="text-muted-foreground text-xs">{s.fechadaEm ?? s.abertaEm}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
