"use client";

// Confirmação de venda concluída (feature 009, US2) — espelha o VendaConcluida do
// PDV (feedback animado). Mostra Pedido Nº do turno, total e troco.
import { CheckCircle2 } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { reais } from "@/utils/texto";
import type { VendaResultado } from "@/lib/nuvem/venda";

export function VendaConcluida({ resultado, onNova }: { resultado: VendaResultado; onNova: () => void }) {
  return (
    <div className="bg-card venda-concluida-card mx-auto w-full max-w-md space-y-4 rounded-lg border p-5 text-center sm:p-6">
      <CheckCircle2 className="text-emerald-500 mx-auto" size={48} />
      <div>
        <div className="text-lg font-semibold">Venda concluída</div>
        <div className="text-muted-foreground text-sm">Pedido Nº {resultado.numeroNoTurno} do turno</div>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="tabular-nums font-medium">{reais(resultado.totalCentavos)}</span>
        </div>
        {resultado.trocoCentavos > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Troco</span>
            <span className="tabular-nums font-medium">{reais(resultado.trocoCentavos)}</span>
          </div>
        )}
      </div>
      <Button onClick={onNova} className="h-9 w-full">
        Nova venda
      </Button>
    </div>
  );
}
