// Bloqueio incisivo do PDV sem turno (feature 013, FR-002): a janela de venda
// NÃO renderiza a interface de venda — no lugar dela vai uma chamada destacada
// para abrir o turno. Não é um aviso dispensável: sem turno não se vende.
// Também mora aqui o alerta de turno que atravessou a virada do dia (FR-023):
// avisa para conferir/fechar, mas o PDV nunca fecha o turno sozinho.

import { Link } from "react-router-dom";
import { AlarmClock, Lock } from "lucide-react";

export function SemTurno({ maquina }: { maquina: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md rounded-xl border-2 border-dashed bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#1f7a4d]/10 text-[#1f7a4d]">
          <Lock size={26} />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Nenhum turno aberto</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Toda venda pertence a um turno. Abra o turno deste PDV
          {maquina ? ` (${maquina})` : ""} para começar a vender.
        </p>
        <Link
          to="/turnos"
          className="mt-5 inline-flex h-10 items-center rounded-md bg-[#1f7a4d] px-5 text-sm font-medium text-white hover:bg-[#1a6a43]"
        >
          Abrir turno
        </Link>
      </div>
    </div>
  );
}

/** Data (yyyy-mm-dd) da abertura, comparada com hoje — sem fuso/parse de Date. */
export function turnoVirouODia(abertura: string): boolean {
  const dia = abertura.slice(0, 10);
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate(),
  ).padStart(2, "0")}`;
  return dia !== "" && dia < hojeIso;
}

export function AvisoTurnoVirado({ abertura }: { abertura: string }) {
  if (!turnoVirouODia(abertura)) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-500 bg-amber-50 px-4 py-2 text-sm text-amber-800">
      <AlarmClock size={16} />
      <span className="flex-1">
        Este turno está aberto desde {new Date(abertura).toLocaleDateString("pt-BR")}. Confira o
        caixa e encerre-o.
      </span>
      <Link to="/turnos" className="rounded-md bg-[#1f7a4d] px-3 py-1.5 text-white hover:bg-[#1a6a43]">
        Fechar turno
      </Link>
    </div>
  );
}
