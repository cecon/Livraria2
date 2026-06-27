// Detalhe SOMENTE-LEITURA de um inventário realizado (US3, FR-011/013/015):
// agregados + itens (sistema × contado × diferença) + pendências da sessão.
// Não há nenhuma ação de edição/reabertura/reaplicação.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResumoCard } from "@/components/ResumoCard";
import { inventarioRelatorio } from "@/lib/ipc";
import type { RelatorioSessao } from "@/lib/types";

export function InventarioDetalhe({
  sessaoId,
  onVoltar,
}: {
  sessaoId: number;
  onVoltar: () => void;
}) {
  const [rel, setRel] = useState<RelatorioSessao | null>(null);

  useEffect(() => {
    inventarioRelatorio(sessaoId)
      .then(setRel)
      .catch(() => setRel(null));
  }, [sessaoId]);

  if (!rel) return null;
  const { sessao, resumo, itens, pendencias } = rel;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-medium">
            Inventário {sessao.modo === "total" ? "total" : "parcial"}
            {sessao.rotulo ? ` · ${sessao.rotulo}` : ""}
          </h2>
          <div className="text-muted-foreground text-xs">
            {sessao.status} · aberto {sessao.abertaEm}
            {sessao.fechadaEm ? ` · fechado ${sessao.fechadaEm}` : ""}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onVoltar}>
          Voltar
        </Button>
      </div>

      <ResumoCard resumo={resumo} />

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-2 text-left font-medium">Livro</th>
              <th className="p-2 text-right font-medium">Sistema</th>
              <th className="p-2 text-right font-medium">Contado</th>
              <th className="p-2 text-right font-medium">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((l) => (
              <tr key={l.codigo} className="border-t">
                <td className="p-2">{l.titulo}</td>
                <td className="p-2 text-right font-mono">{l.qtdSistema}</td>
                <td className="p-2 text-right font-mono">{l.qtdContada}</td>
                <td
                  className={`p-2 text-right font-mono ${
                    l.diferenca === 0
                      ? "text-muted-foreground"
                      : l.diferenca > 0
                        ? "text-emerald-600"
                        : "text-red-600"
                  }`}
                >
                  {l.diferenca > 0 ? `+${l.diferenca}` : l.diferenca}
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted-foreground p-4 text-center">
                  Nenhum item contado nesta sessão.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pendencias.length > 0 && (
        <div className="bg-card rounded-xl border p-4">
          <h3 className="text-sm font-medium">Pendências da sessão</h3>
          <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
            {pendencias.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span className="font-mono">{p.codigoLido}</span>
                <span>
                  contados: {p.qtd}
                  {p.resolvida ? " · resolvida" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
