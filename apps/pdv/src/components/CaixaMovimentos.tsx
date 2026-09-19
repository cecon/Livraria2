import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@livraria/ui/wowdash/button";
import { Input } from "@livraria/ui/wowdash/input";
import { Label } from "@livraria/ui/ui/label";
import { brl } from "@/lib/format";
import { ValorCentavosInput } from "@/components/ValorCentavosInput";
import { caixaMovimentoRegistrar, caixaMovimentosListar, type MovimentoCaixa } from "@/lib/ipc";

type Tipo = "sangria" | "suprimento";

export function CaixaMovimentos({ turnoUid, operador, saldo, tipoInicial, onRegistrar }: {
  turnoUid: string;
  operador: string;
  saldo: number;
  tipoInicial: Tipo;
  onRegistrar: () => Promise<void>;
}) {
  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const [valorCentavos, setValorCentavos] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [movimentos, setMovimentos] = useState<MovimentoCaixa[]>([]);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    caixaMovimentosListar(turnoUid).then(setMovimentos).catch((e) => toast.error(String(e)));
  }, [turnoUid]);

  useEffect(() => { setTipo(tipoInicial); }, [tipoInicial]);

  async function registrar() {
    if (valorCentavos <= 0 || !motivo.trim()) {
      toast.error("Informe valor positivo e motivo");
      return;
    }
    if (tipo === "sangria" && valorCentavos > saldo) {
      toast.error("Sangria maior que o dinheiro esperado no caixa");
      return;
    }
    setOcupado(true);
    try {
      await caixaMovimentoRegistrar(turnoUid, operador, tipo, valorCentavos, motivo.trim());
      setMovimentos(await caixaMovimentosListar(turnoUid));
      await onRegistrar();
      setValorCentavos(0);
      setMotivo("");
      toast.success(tipo === "sangria" ? "Sangria registrada" : "Suprimento registrado");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="space-y-4 border-t pt-4">
      <h2 className="text-sm font-semibold">Movimentos de caixa</h2>
      <div className="flex gap-1" role="group" aria-label="Tipo de movimento">
        <Button type="button" variant={tipo === "sangria" ? "default" : "outline"} size="lg" onClick={() => setTipo("sangria")}
          aria-pressed={tipo === "sangria"}
          className="gap-2">
          <ArrowUp size={15} /> Sangria
        </Button>
        <Button type="button" variant={tipo === "suprimento" ? "default" : "outline"} size="lg" onClick={() => setTipo("suprimento")}
          aria-pressed={tipo === "suprimento"}
          className="gap-2">
          <ArrowDown size={15} /> Suprimento
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <div className="space-y-1"><Label htmlFor="caixa-valor">Valor</Label>
          <ValorCentavosInput id="caixa-valor" centavos={valorCentavos} onCentavosChange={setValorCentavos} className="h-9" />
        </div>
        <div className="space-y-1"><Label htmlFor="caixa-motivo">Motivo</Label>
          <Input id="caixa-motivo" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} maxLength={200} className="h-9" />
        </div>
        <Button type="button" size="lg" onClick={registrar} disabled={ocupado}>
          Registrar {tipo}
        </Button>
      </div>
      {movimentos.length > 0 && (
        <div className="divide-y text-sm">
          {movimentos.map((m) => (
            <div key={m.syncUid} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <span className="font-medium">{m.tipo === "sangria" ? "Sangria" : "Suprimento"}</span>
                <span className="ml-2 text-muted-foreground">{m.motivo}</span>
                <div className="text-xs text-muted-foreground">{new Date(m.criadoEm).toLocaleString("pt-BR")} | {m.operador}</div>
              </div>
              <span className="tabular-nums">{m.tipo === "sangria" ? "-" : "+"}{brl(m.valorCentavos)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
