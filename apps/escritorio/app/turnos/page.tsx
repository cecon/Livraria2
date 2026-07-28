"use client";

// Turno de operação (feature 009, US1) — abrir (caixa inicial opcional), acompanhar
// o resumo ao vivo e encerrar com fechamento de caixa. Sem tela equivalente no PDV
// (conceito novo, ADR-0021).
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Play } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { FechamentoCaixa } from "@/components/FechamentoCaixa";
import { brl, parseBRLInput } from "@/lib/brl";
import {
  abrirTurno,
  encerrarTurno,
  listarTurnos,
  resumoDoTurno,
  turnoAberto,
  type ResumoTurno,
  type TurnoAberto,
  type TurnoHistorico,
} from "@/lib/nuvem/turno";

export default function TurnosPage() {
  const [carregando, setCarregando] = useState(true);
  const [turno, setTurno] = useState<TurnoAberto | null>(null);
  const [resumo, setResumo] = useState<ResumoTurno | null>(null);
  const [historico, setHistorico] = useState<TurnoHistorico[]>([]);
  const [caixaInicial, setCaixaInicial] = useState("");
  const [encerrando, setEncerrando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const aberto = await turnoAberto();
      setTurno(aberto);
      setResumo(aberto ? await resumoDoTurno(aberto.sync_uid, aberto.caixaInicialCentavos) : null);
      setHistorico(await listarTurnos());
    } catch {
      toast.error("Não foi possível carregar os turnos. Verifique o login.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function abrir() {
    setOcupado(true);
    const centavos = parseBRLInput(caixaInicial);
    const { error } = await abrirTurno(centavos);
    setOcupado(false);
    if (error) return toast.error(error);
    toast.success("Turno aberto");
    setCaixaInicial("");
    carregar();
  }

  async function encerrar(conferidoCentavos: number) {
    if (!turno) return;
    setOcupado(true);
    const { error, diferencaCentavos } = await encerrarTurno(turno.sync_uid, turno.caixaInicialCentavos, conferidoCentavos);
    setOcupado(false);
    if (error) return toast.error(error);
    toast.success(diferencaCentavos === 0 ? "Turno encerrado — caixa confere" : `Turno encerrado — diferença de ${brl(Math.abs(diferencaCentavos ?? 0))}`);
    setEncerrando(false);
    carregar();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Clock size={20} /> Turno de operação
        </h1>
        <p className="text-muted-foreground text-sm">
          Abra um turno antes de vender. As vendas ficam contidas no turno e numeradas em sequência própria; ao
          encerrar, confira o caixa (dinheiro).
        </p>
      </div>

      {carregando ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : !turno ? (
        <div className="bg-card space-y-3 rounded-lg border p-4">
          <div className="text-sm font-medium">Nenhum turno aberto</div>
          <div>
            <Label htmlFor="caixa">Caixa inicial (opcional)</Label>
            <Input
              id="caixa"
              value={caixaInicial}
              onChange={(e) => setCaixaInicial(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && abrir()}
              placeholder="R$ 0,00"
              inputMode="decimal"
              className="mt-1 h-9"
            />
          </div>
          <Button onClick={abrir} disabled={ocupado} className="h-9">
            <Play size={15} /> Abrir turno
          </Button>
        </div>
      ) : encerrando && resumo ? (
        <FechamentoCaixa resumo={resumo} ocupado={ocupado} onConfirmar={encerrar} onCancelar={() => setEncerrando(false)} />
      ) : (
        <div className="bg-card space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Turno aberto</div>
            <span className="text-muted-foreground text-xs">desde {new Date(turno.abertura).toLocaleString("pt-BR")}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Resumo rotulo="Caixa inicial" valor={brl(turno.caixaInicialCentavos)} />
            <Resumo rotulo="Vendas no turno" valor={String(resumo?.qtdVendas ?? 0)} />
            <Resumo rotulo="Dinheiro esperado" valor={brl(resumo?.esperadoDinheiroCentavos ?? turno.caixaInicialCentavos)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setEncerrando(true)} className="h-9">Encerrar turno</Button>
            <Button variant="ghost" onClick={carregar} className="h-9">Atualizar</Button>
          </div>
        </div>
      )}

      {historico.filter((t) => t.status === "encerrado").length > 0 && (
        <div className="space-y-1">
          <div className="text-muted-foreground text-xs uppercase">Turnos encerrados</div>
          {historico
            .filter((t) => t.status === "encerrado")
            .map((t) => (
              <div key={t.sync_uid} className="bg-card flex items-center justify-between rounded-lg border p-2 text-sm">
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

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="bg-muted/40 rounded-md p-2">
      <div className="text-muted-foreground text-[11px] uppercase">{rotulo}</div>
      <div className="tabular-nums font-medium">{valor}</div>
    </div>
  );
}
