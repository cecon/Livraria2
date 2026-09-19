"use client";

import { KeyRound, Pencil, PowerOff } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import type { Machine } from "./types";

function money(value: string): string {
  const cents = BigInt(value || "0");
  const absolute = cents < 0n ? -cents : cents;
  const whole = new Intl.NumberFormat("pt-BR").format(absolute / 100n);
  return `${cents < 0n ? "-" : ""}R$ ${whole},${(absolute % 100n).toString().padStart(2, "0")}`;
}

function status(machine: Machine) {
  if (!machine.ativo) return { label: "Inativa", style: "bg-muted text-muted-foreground" };
  if (BigInt(machine.cursorAplicado) >= BigInt(machine.cursorDisponivel)) {
    return { label: "Atualizada", style: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" };
  }
  if (BigInt(machine.cursorEntregue) > BigInt(machine.cursorAplicado)) {
    return { label: "Aplicando", style: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" };
  }
  return { label: "Pendente", style: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" };
}

export function MachineList({ machines, busyUid, onEdit, onRotate, onDisable }: {
  machines: Machine[];
  busyUid: string | null;
  onEdit: (machine: Machine) => void;
  onRotate: (machine: Machine) => void;
  onDisable: (machine: Machine) => void;
}) {
  return <div className="overflow-x-auto">
    <table className="w-full table-fixed text-sm">
      <thead className="text-left text-muted-foreground"><tr>
        <th className="p-3">Máquina</th><th className="hidden p-3 md:table-cell">Operador</th>
        <th className="hidden p-3 lg:table-cell">Turno e vendas</th>
        <th className="hidden w-28 p-3 sm:table-cell">Situação</th><th className="w-[124px] p-3 text-right">Ações</th>
      </tr></thead>
      <tbody>
        {!machines.length ? <tr><td colSpan={5} className="p-7 text-center text-muted-foreground">Nenhuma máquina cadastrada.</td></tr> : machines.map(machine => {
          const sync = status(machine);
          const busy = busyUid === machine.uid;
          return <tr key={machine.uid} className="border-t">
            <td className="p-3"><div className="truncate font-medium">{machine.nome}</div>
              <div className="truncate text-xs text-muted-foreground md:hidden">{machine.usuarioNome || machine.usuario}</div>
              <div className="mt-1 text-xs text-muted-foreground lg:hidden">
                {machine.turnoStatus ? `${machine.turnoStatus === "aberto" ? "Turno aberto" : "Turno encerrado"} · ${machine.turnoOperador || "Sem operador"} · ${machine.vendasTurno} venda(s) · ${money(machine.totalTurnoCentavos)}` : "Nenhum turno recebido"}
              </div>
              {machine.turnoStatus ? <div className="text-xs text-muted-foreground lg:hidden">
                Inicial {money(machine.caixaInicialCentavos)} · +{money(machine.suprimentosCentavos)} · -{money(machine.sangriasCentavos)}
              </div> : null}
              <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-medium sm:hidden ${sync.style}`}>{sync.label}</span>
            </td>
            <td className="hidden p-3 md:table-cell"><div className="truncate">{machine.usuarioNome || machine.usuario}</div>
              <div className="truncate text-xs text-muted-foreground">{machine.usuario}</div></td>
            <td className="hidden p-3 lg:table-cell">
              {machine.turnoStatus ? <>
                <div className="font-medium">{machine.turnoStatus === "aberto" ? "Aberto" : "Encerrado"} · {machine.turnoOperador || "Sem operador"}</div>
                <div className="text-xs text-muted-foreground">{machine.vendasTurno} venda(s) · {money(machine.totalTurnoCentavos)}</div>
                <div className="text-xs text-muted-foreground">Inicial {money(machine.caixaInicialCentavos)} · Suprimentos +{money(machine.suprimentosCentavos)} · Sangrias -{money(machine.sangriasCentavos)}</div>
                {machine.esperadoCentavos !== null ? <div className="text-xs text-muted-foreground">
                  Fechamento: esperado {money(machine.esperadoCentavos)} · conferido {money(machine.conferidoCentavos || "0")} · diferença {money(machine.diferencaCentavos || "0")}
                </div> : null}
                <div className="text-xs text-muted-foreground">{machine.turnoStatus === "aberto" ? "Desde" : "Fechado em"} {new Date(machine.turnoEncerramento || machine.turnoAbertura || "").toLocaleString("pt-BR")}</div>
              </> : <span className="text-muted-foreground">Nenhum turno recebido</span>}
            </td>
            <td className="hidden p-3 sm:table-cell"><span className={`rounded px-2 py-1 text-xs font-medium ${sync.style}`}>{sync.label}</span></td>
            <td className="space-x-1 p-3 text-right">
              {machine.ativo ? <>
                <Button size="icon-sm" variant="outline" disabled={busy} onClick={() => onEdit(machine)} title="Editar máquina"><Pencil /></Button>
                <Button size="icon-sm" variant="outline" disabled={busy} onClick={() => onRotate(machine)} title="Gerar nova credencial"><KeyRound /></Button>
                <Button size="icon-sm" variant="destructive" disabled={busy} onClick={() => onDisable(machine)} title="Desativar máquina"><PowerOff /></Button>
              </> : <span className="text-xs text-muted-foreground">Desativada</span>}
            </td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}
