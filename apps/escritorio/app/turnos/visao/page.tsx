"use client";

// Visão de turnos (feature 013, US6 — FR-018/FR-019): o escritório enxerga os
// turnos de TODOS os PDVs, filtra por máquina/estado/período e pode encerrar um
// turno esquecido. O fechamento desce pelo sync; o PDV aplica e migra o que
// ainda não tinha subido (FR-024).

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Monitor, RefreshCw } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { brl } from "@/lib/brl";
import {
  encerrarTurnoPelaNuvem,
  listarMaquinas,
  listarTurnos,
  type FiltroTurnos,
  type TurnoLinha,
} from "@/lib/nuvem/turnos-visao";

function dataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR");
}

export default function VisaoTurnosPage() {
  const [filtro, setFiltro] = useState<FiltroTurnos>({ status: "" });
  const [linhas, setLinhas] = useState<TurnoLinha[]>([]);
  const [maquinas, setMaquinas] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setLinhas(await listarTurnos(filtro));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao listar os turnos");
    } finally {
      setCarregando(false);
    }
  }, [filtro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    listarMaquinas().then(setMaquinas).catch(() => setMaquinas([]));
  }, []);

  async function encerrar(t: TurnoLinha) {
    const onde = t.maquina ?? "este PDV";
    if (!window.confirm(`Encerrar o turno de ${onde} (${t.operador ?? "—"})?`)) return;
    setOcupado(t.syncUid);
    const { error } = await encerrarTurnoPelaNuvem(t.syncUid);
    setOcupado("");
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Turno encerrado — o PDV aplica no próximo sync");
    carregar();
  }

  const abertos = linhas.filter((l) => l.status === "aberto").length;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Monitor size={20} /> Turnos dos PDVs
          </h1>
          <p className="text-muted-foreground text-sm">
            {abertos} aberto(s) · {linhas.length} turno(s) no filtro. Encerrar aqui destrava um
            turno esquecido no balcão.
          </p>
        </div>
        <Button variant="ghost" onClick={carregar} disabled={carregando}>
          <RefreshCw size={15} /> Atualizar
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <div>
          <Label htmlFor="de">De</Label>
          <Input
            id="de"
            type="date"
            value={filtro.de ?? ""}
            onChange={(e) => setFiltro({ ...filtro, de: e.currentTarget.value })}
            className="mt-1 h-9"
          />
        </div>
        <div>
          <Label htmlFor="ate">Até</Label>
          <Input
            id="ate"
            type="date"
            value={filtro.ate ?? ""}
            onChange={(e) => setFiltro({ ...filtro, ate: e.currentTarget.value })}
            className="mt-1 h-9"
          />
        </div>
        <div>
          <Label htmlFor="status">Estado</Label>
          <select
            id="status"
            value={filtro.status ?? ""}
            onChange={(e) => setFiltro({ ...filtro, status: e.currentTarget.value })}
            className="bg-background mt-1 h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="aberto">Abertos</option>
            <option value="encerrado">Encerrados</option>
          </select>
        </div>
        <div>
          <Label htmlFor="maquina">Máquina</Label>
          <select
            id="maquina"
            value={filtro.maquina ?? ""}
            onChange={(e) => setFiltro({ ...filtro, maquina: e.currentTarget.value })}
            className="bg-background mt-1 h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="">Todas</option>
            {maquinas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {carregando ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : linhas.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum turno neste filtro.</p>
        ) : (
          linhas.map((t) => (
            <div
              key={t.syncUid}
              className="bg-card flex items-center gap-3 rounded-lg border p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <span className="font-mono">{t.maquina ?? "sem máquina"}</span>
                  <span className="text-muted-foreground">· {t.operador ?? "—"}</span>
                  {t.status === "aberto" ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-emerald-700">
                      aberto
                    </span>
                  ) : (
                    <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] uppercase">
                      encerrado
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground text-xs">
                  {dataHora(t.abertura)} → {dataHora(t.encerramento)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono">{brl(t.totalCentavos)}</div>
                <div className="text-muted-foreground text-xs">{t.qtdVendas} venda(s)</div>
              </div>
              {t.diferencaCentavos !== null && t.diferencaCentavos !== 0 && (
                <span className="font-mono text-xs text-amber-600">
                  dif. {brl(Math.abs(t.diferencaCentavos))}
                </span>
              )}
              {t.status === "aberto" && (
                <Button
                  variant="outline"
                  disabled={ocupado === t.syncUid}
                  onClick={() => encerrar(t)}
                >
                  Fechar turno
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
