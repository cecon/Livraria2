"use client";

// Recebimento por forma de pagamento (feature 009, US2) — um campo por forma ativa.
// O total/restante/troco é mostrado ao vivo; a validação final (troco só do
// dinheiro) é do domínio via WASM no momento de concluir.
import { Input } from "@livraria/ui/ui/input";
import { reais } from "@/utils/texto";
import type { Forma } from "@/lib/nuvem/forma";

export function FormasPagamento({
  formas,
  valores,
  onValor,
  totalCentavos,
  pagoCentavos,
}: {
  formas: Forma[];
  valores: Map<string, string>;
  onValor: (formaUid: string, valor: string) => void;
  totalCentavos: number;
  pagoCentavos: number;
}) {
  const restante = Math.max(0, totalCentavos - pagoCentavos);
  const troco = Math.max(0, pagoCentavos - totalCentavos);
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {formas.map((f) => (
          <div key={f.sync_uid} className="flex items-center gap-2">
            <span className="w-32 text-sm">{f.rotulo}</span>
            <Input
              value={valores.get(f.sync_uid) ?? ""}
              onChange={(e) => onValor(f.sync_uid, e.currentTarget.value)}
              placeholder="R$ 0,00"
              inputMode="decimal"
              className="h-9 flex-1"
            />
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t pt-2 text-sm">
        <Linha rotulo="Total" valor={reais(totalCentavos)} destaque />
        {restante > 0 && <Linha rotulo="Falta" valor={reais(restante)} classe="text-amber-600" />}
        {troco > 0 && <Linha rotulo="Troco" valor={reais(troco)} classe="text-emerald-600" />}
      </div>
    </div>
  );
}

function Linha({ rotulo, valor, destaque, classe }: { rotulo: string; valor: string; destaque?: boolean; classe?: string }) {
  return (
    <div className={`flex justify-between ${classe ?? ""}`}>
      <span className={destaque ? "font-medium" : "text-muted-foreground"}>{rotulo}</span>
      <span className={`tabular-nums ${destaque ? "font-semibold" : ""}`}>{valor}</span>
    </div>
  );
}
