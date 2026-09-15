// Confirmação animada de venda concluída (US4, FR-015): total e troco em
// destaque, auto-dispensa em segundos e NUNCA bloqueia — pointer-events:none,
// e qualquer bipagem/interação da próxima venda a dispensa via onDispensar.

import { useEffect } from "react";
import { brl } from "@/lib/format";

const AUTO_DISPENSA_MS = 4000;

export interface VendaConcluidaInfo {
  numero: number;
  totalCentavos: number;
  trocoCentavos: number;
}

export function VendaConcluida({
  info,
  onDispensar,
}: {
  info: VendaConcluidaInfo;
  onDispensar: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDispensar, AUTO_DISPENSA_MS);
    return () => clearTimeout(t);
  }, [info, onDispensar]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="venda-concluida-card bg-card w-72 rounded-2xl border-2 border-[#1f7a4d] p-6 text-center shadow-xl">
        <svg
          viewBox="0 0 24 24"
          width="44"
          height="44"
          className="mx-auto text-[#1f7a4d]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" opacity="0.25" />
          <path className="venda-concluida-check" d="M7 12.5l3.2 3.2L17 9" />
        </svg>
        <div className="mt-2 text-lg font-semibold text-[#1f7a4d]">
          Venda concluída
        </div>
        <div className="text-muted-foreground text-xs">
          Pedido Nº {info.numero}
        </div>
        <div className="mt-2 font-mono text-2xl font-bold">
          {brl(info.totalCentavos)}
        </div>
        {info.trocoCentavos > 0 && (
          <div className="mt-1 text-sm">
            Troco{" "}
            <span className="font-mono font-semibold text-emerald-600">
              {brl(info.trocoCentavos)}
            </span>
          </div>
        )}
        <div className="text-muted-foreground mt-3 text-[11px] uppercase tracking-wide">
          Caixa livre — pronto para a próxima venda
        </div>
      </div>
    </div>
  );
}
