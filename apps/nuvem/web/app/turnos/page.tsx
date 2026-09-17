"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, RefreshCw } from "lucide-react";
import { Button } from "@livraria/ui/wowdash/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/wowdash/table";
import { LoadFailure } from "@/components/LoadFailure";
import { listarTurnos, type TurnoPdv } from "@/lib/nuvem/turno";

function dinheiro(value: string | null): string {
  if (value === null) return "—";
  const cents = BigInt(value);
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "-" : ""}R$ ${new Intl.NumberFormat("pt-BR").format(absolute / 100n)},${(absolute % 100n).toString().padStart(2, "0")}`;
}

export default function TurnosPage() {
  const [turnos, setTurnos] = useState<TurnoPdv[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const carregar = useCallback(async () => {
    try {
      setTurnos(await listarTurnos());
      setErro(null);
      setAtualizadoEm(new Date());
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Turnos indisponíveis.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void carregar();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [carregar]);

  return <div className="space-y-4 px-4 py-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Clock3 size={20} /> Turnos dos PDVs</h1>
        <p className="text-muted-foreground mt-1 text-sm">Turnos recebidos das máquinas, em atualização automática.{atualizadoEm && ` Atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR")}.`}</p>
      </div>
      <Button variant="outline" onClick={() => void carregar()} aria-label="Atualizar turnos" title="Atualizar turnos"><RefreshCw size={16} /> Atualizar</Button>
    </div>
    {erro && <LoadFailure title="Não foi possível atualizar os turnos" message={erro} onRetry={carregar} />}
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b px-4 py-3 text-sm font-semibold">Últimos turnos <span className="text-muted-foreground font-normal">· {turnos.filter((turno) => turno.status === "aberto").length} aberto(s)</span></div>
      <Table>
        <TableHeader><TableRow className="bg-muted/40">
          <TableHead className="px-4">Máquina / responsável</TableHead><TableHead>Situação</TableHead>
          <TableHead className="hidden md:table-cell">Abertura</TableHead><TableHead className="hidden lg:table-cell">Troco inicial</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Vendas</TableHead><TableHead className="px-4 text-right">Total</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {turnos.map((turno) => <TableRow key={turno.sync_uid}>
            <TableCell className="px-4"><div className="font-medium">{turno.maquina}</div><div className="text-muted-foreground text-xs">{turno.operador}</div><div className="text-muted-foreground text-xs sm:hidden">{turno.vendas} venda(s)</div></TableCell>
            <TableCell><span className={`inline-block rounded px-2 py-1 text-xs font-medium ${turno.status === "aberto" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{turno.status === "aberto" ? "Aberto" : "Encerrado"}</span></TableCell>
            <TableCell className="hidden md:table-cell">{new Date(turno.abertura).toLocaleString("pt-BR")}</TableCell>
            <TableCell className="hidden lg:table-cell tabular-nums">{dinheiro(turno.caixaInicialCentavos)}</TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{turno.vendas}</TableCell>
            <TableCell className="px-4 text-right tabular-nums">{dinheiro(turno.totalVendidoCentavos)}</TableCell>
          </TableRow>)}
          {!carregando && turnos.length === 0 && <TableRow><TableCell colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum turno de PDV recebido.</TableCell></TableRow>}
        </TableBody>
      </Table>
      {carregando && <p className="p-8 text-center text-sm text-muted-foreground">Carregando turnos…</p>}
    </div>
  </div>;
}
