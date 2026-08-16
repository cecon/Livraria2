"use client";

// Recebimento por forma de pagamento — **paridade com o PDV** (`PaymentRow`):
// input estilo **maquininha** (só dígitos; as 2 casas entram da direita p/ a
// esquerda) e um **botão que recebe o restante** na forma clicada. Total/Falta/
// Troco ao vivo; a validação final (troco só do dinheiro) é do domínio via WASM.
import { Input } from "@livraria/ui/ui/input";
import { Button } from "@livraria/ui/ui/button";
import { reais } from "@/utils/texto";
import { brl, digitosParaCentavos, valorPos } from "@/lib/brl";
import type { Forma } from "@/lib/nuvem/forma";

export function FormasPagamento({
  formas,
  valores,
  onValor,
  onReceberRestante,
  totalCentavos,
  pagoCentavos,
}: {
  formas: Forma[];
  /** formaUid → centavos (inteiro), como no PDV. */
  valores: Map<string, number>;
  onValor: (formaUid: string, centavos: number) => void;
  onReceberRestante: (formaUid: string) => void;
  totalCentavos: number;
  pagoCentavos: number;
}) {
  const restante = Math.max(0, totalCentavos - pagoCentavos);
  const troco = Math.max(0, pagoCentavos - totalCentavos);
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {formas.map((f) => {
          const v = valores.get(f.sync_uid) ?? 0;
          return (
            <div key={f.sync_uid} className="flex items-center gap-2">
              <span className="text-muted-foreground w-28 truncate text-[13px]" title={f.rotulo}>
                {f.rotulo}
              </span>
              <Input
                inputMode="numeric"
                placeholder="0,00"
                value={v > 0 ? valorPos(v) : ""}
                onChange={(e) => onValor(f.sync_uid, digitosParaCentavos(e.currentTarget.value))}
                className="h-9 flex-1 text-right font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={restante <= 0}
                onClick={() => onReceberRestante(f.sync_uid)}
                className="h-9 shrink-0 font-mono text-[12px]"
                title={`Receber ${brl(restante)} nesta forma`}
              >
                {brl(restante)}
              </Button>
            </div>
          );
        })}
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
