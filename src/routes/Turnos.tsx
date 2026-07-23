// Turno de operação no PDV (feature 009, ADR-0021) — abrir (caixa inicial opcional),
// acompanhar o resumo e encerrar com fechamento de caixa (conferência só do dinheiro).
// Mesmo conceito/regra do Escritório (domínio compartilhado); persiste local e sincroniza.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Play } from "lucide-react";
import { operadorAtual } from "@/lib/operador";
import { brl, parseBrlParaCentavos } from "@/lib/format";
import { listarFormasAtivas } from "@/lib/ipc_formas";
import {
  turnoAberto,
  turnoAbrir,
  turnoResumo,
  turnoEncerrar,
  turnoListar,
  type TurnoAberto,
  type ResumoTurno,
  type TurnoHistorico,
} from "@/lib/ipc";

export default function Turnos() {
  const operador = operadorAtual();
  const [carregando, setCarregando] = useState(true);
  const [turno, setTurno] = useState<TurnoAberto | null>(null);
  const [resumo, setResumo] = useState<ResumoTurno | null>(null);
  const [rotulos, setRotulos] = useState<Map<number, string>>(new Map());
  const [historico, setHistorico] = useState<TurnoHistorico[]>([]);
  const [caixa, setCaixa] = useState("");
  const [conferido, setConferido] = useState("");
  const [encerrando, setEncerrando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    if (!operador) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    try {
      const [aberto, formas] = await Promise.all([turnoAberto(operador), listarFormasAtivas()]);
      setRotulos(new Map(formas.map((f) => [f.id, f.rotulo])));
      setTurno(aberto);
      setResumo(aberto ? await turnoResumo(aberto.syncUid) : null);
      setHistorico(await turnoListar(operador));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCarregando(false);
    }
  }, [operador]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function abrir() {
    setOcupado(true);
    try {
      await turnoAbrir(operador, parseBrlParaCentavos(caixa) ?? 0);
      toast.success("Turno aberto");
      setCaixa("");
      await carregar();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setOcupado(false);
    }
  }

  async function encerrar() {
    if (!turno) return;
    setOcupado(true);
    try {
      const f = await turnoEncerrar(turno.syncUid, parseBrlParaCentavos(conferido) ?? 0);
      toast.success(f.diferencaCentavos === 0 ? "Turno encerrado — caixa confere" : `Turno encerrado — diferença de ${brl(Math.abs(f.diferencaCentavos))}`);
      setEncerrando(false);
      setConferido("");
      await carregar();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setOcupado(false);
    }
  }

  if (!operador) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Selecione o operador do caixa (barra lateral) para usar o turno.
        </div>
      </div>
    );
  }

  const esperado = resumo?.esperadoDinheiroCentavos ?? turno?.caixaInicialCentavos ?? 0;
  const dif = (parseBrlParaCentavos(conferido) ?? 0) - esperado;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Clock size={20} /> Turno de operação
        </h1>
        <p className="text-sm text-muted-foreground">
          Abra um turno antes de vender. As vendas ficam contidas no turno e numeradas em sequência própria;
          ao encerrar, confira o caixa (dinheiro).
        </p>
      </div>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !turno ? (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">Nenhum turno aberto</div>
          <label className="block text-sm">
            Caixa inicial (opcional)
            <input
              value={caixa}
              onChange={(e) => setCaixa(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && abrir()}
              placeholder="R$ 0,00"
              className="mt-1 h-9 w-full rounded-md border bg-background px-3"
            />
          </label>
          <button onClick={abrir} disabled={ocupado} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1f7a4d] px-4 text-sm text-white hover:bg-[#1a6a43] disabled:opacity-60">
            <Play size={15} /> Abrir turno
          </button>
        </div>
      ) : encerrando && resumo ? (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">Fechamento de caixa</div>
          <div className="space-y-1 text-sm">
            {resumo.porForma.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma venda no turno.</p>
            ) : (
              resumo.porForma.map(([id, c]) => (
                <div key={id} className="flex justify-between">
                  <span>{rotulos.get(id) ?? `Forma ${id}`}</span>
                  <span className="tabular-nums">{brl(c)}</span>
                </div>
              ))
            )}
          </div>
          <div className="space-y-2 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dinheiro esperado</span>
              <span className="font-medium tabular-nums">{brl(esperado)}</span>
            </div>
            <label className="block">
              Dinheiro conferido (contagem física)
              <input value={conferido} autoFocus onChange={(e) => setConferido(e.currentTarget.value)} placeholder="R$ 0,00" className="mt-1 h-9 w-full rounded-md border bg-background px-3" />
            </label>
            {conferido.trim() !== "" && (
              <div className={`flex justify-between ${dif === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                <span>{dif === 0 ? "Confere" : dif > 0 ? "Sobra" : "Falta"}</span>
                <span className="font-medium tabular-nums">{brl(Math.abs(dif))}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={encerrar} disabled={ocupado} className="h-9 rounded-md bg-[#1f7a4d] px-4 text-sm text-white hover:bg-[#1a6a43] disabled:opacity-60">Encerrar turno</button>
            <button onClick={() => setEncerrando(false)} disabled={ocupado} className="h-9 rounded-md px-4 text-sm hover:bg-muted">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Turno aberto</div>
            <span className="text-xs text-muted-foreground">desde {new Date(turno.abertura).toLocaleString("pt-BR")}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat rotulo="Caixa inicial" valor={brl(turno.caixaInicialCentavos)} />
            <Stat rotulo="Vendas" valor={String(resumo?.qtdVendas ?? 0)} />
            <Stat rotulo="Dinheiro esperado" valor={brl(esperado)} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEncerrando(true)} className="h-9 rounded-md bg-[#1f7a4d] px-4 text-sm text-white hover:bg-[#1a6a43]">Encerrar turno</button>
            <button onClick={carregar} className="h-9 rounded-md px-4 text-sm hover:bg-muted">Atualizar</button>
          </div>
        </div>
      )}

      {historico.filter((t) => t.status === "encerrado").length > 0 && (
        <div className="space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Turnos encerrados</div>
          {historico
            .filter((t) => t.status === "encerrado")
            .map((t, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border bg-card p-2 text-sm">
                <span className="text-muted-foreground">{new Date(t.abertura).toLocaleDateString("pt-BR")}</span>
                <span className="tabular-nums">esperado {brl(t.esperadoCentavos ?? 0)}</span>
                <span className={`tabular-nums ${(t.diferencaCentavos ?? 0) === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                  {(t.diferencaCentavos ?? 0) === 0 ? "confere" : `dif. ${brl(Math.abs(t.diferencaCentavos ?? 0))}`}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function Stat({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <div className="text-[11px] uppercase text-muted-foreground">{rotulo}</div>
      <div className="font-medium tabular-nums">{valor}</div>
    </div>
  );
}
