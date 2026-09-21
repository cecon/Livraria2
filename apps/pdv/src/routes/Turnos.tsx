import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight, House, RefreshCw } from "lucide-react";
import { Badge } from "@livraria/ui/wowdash/badge";
import { Button } from "@livraria/ui/wowdash/button";
import { Card, CardContent, CardHeader, CardTitle } from "@livraria/ui/wowdash/card";
import { Label } from "@livraria/ui/ui/label";
import { CaixaMovimentos } from "@/components/CaixaMovimentos";
import { ValorCentavosInput } from "@/components/ValorCentavosInput";
import { brl } from "@/lib/format";
import { listarFormasAtivas } from "@/lib/ipc_formas";
import { listarOperadores, turnoEncerrar, turnoResumo, type ResumoTurno, type TurnoAberto } from "@/lib/ipc";

export default function Turnos({ turno, onClosed }: { turno: TurnoAberto; onClosed: () => void }) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const tipoInicial = new URLSearchParams(search).get("movimento") === "suprimento" ? "suprimento" : "sangria";
  const [resumo, setResumo] = useState<ResumoTurno | null>(null);
  const [rotulos, setRotulos] = useState<Map<number, string>>(new Map());
  const [dinheiroFormaId, setDinheiroFormaId] = useState<number | null>(null);
  const [responsavel, setResponsavel] = useState(turno.operador);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [encerrando, setEncerrando] = useState(() => new URLSearchParams(search).get("encerrar") === "1");
  const [gavetaCentavos, setGavetaCentavos] = useState(0);
  const [maloteCentavos, setMaloteCentavos] = useState(0);
  const [conferenciaIniciada, setConferenciaIniciada] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [dados, formas] = await Promise.all([turnoResumo(turno.syncUid), listarFormasAtivas()]);
      setResumo(dados);
      setRotulos(new Map(formas.map((forma) => [forma.id, forma.rotulo])));
      setDinheiroFormaId(formas.find((forma) => forma.chave === "dinheiro")?.id ?? null);
      setErro(false);
    } catch {
      setErro(true);
    } finally { setCarregando(false); }
  }, [turno.syncUid]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    if (new URLSearchParams(search).get("encerrar") === "1") setEncerrando(true);
  }, [search]);
  useEffect(() => {
    let ativo = true;
    setResponsavel(turno.operador);
    listarOperadores().then((operadores) => {
      const usuario = operadores.find((item) => item.usuario.toLowerCase() === turno.operador.toLowerCase());
      if (ativo) setResponsavel(usuario?.nome || turno.operador);
    }).catch(() => {});
    return () => { ativo = false; };
  }, [turno.operador]);

  async function encerrar() {
    if (!conferenciaIniciada || !resumo || carregando || erro) return toast.error("Atualize e confira o dinheiro antes de fechar o caixa.");
    setOcupado(true);
    try {
      const fechamento = await turnoEncerrar(turno.syncUid, totalConferidoCentavos);
      toast.success(fechamento.diferencaCentavos === 0 ? "Caixa confere" :
        `Diferença de ${brl(Math.abs(fechamento.diferencaCentavos))}`);
      onClosed();
    } catch (error) { toast.error(String(error)); }
    finally { setOcupado(false); }
  }

  const esperado = resumo?.esperadoDinheiroCentavos ?? turno.caixaInicialCentavos;
  const dinheiroVendas = resumo?.porForma.find(([id]) => id === dinheiroFormaId)?.[1] ?? 0;
  const totalConferidoCentavos = gavetaCentavos + maloteCentavos;
  const diferenca = totalConferidoCentavos - esperado;

  return <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{encerrando ? "Encerrar turno" : "Movimentos de caixa"}</h1>
      <nav aria-label="Navegação da página" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="flex items-center gap-2 hover:text-brand"><House size={16} /> Início</Link>
        <ChevronRight size={15} aria-hidden="true" /><span className="font-medium text-foreground" aria-current="page">{encerrando ? "Encerrar turno" : "Movimentos de caixa"}</span>
      </nav>
    </div>

    <Card className="gap-0 rounded-lg py-0">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-lg font-semibold">Caixa aberto</CardTitle>
          <Badge variant="success">Aberto</Badge>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={() => void carregar()} disabled={carregando}
          title="Atualizar turno" aria-label="Atualizar turno"><RefreshCw className={carregando ? "animate-spin" : ""} /></Button>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Responsável" value={responsavel} />
          <Stat label="Aberto em" value={new Date(turno.abertura).toLocaleString("pt-BR")} />
          <Stat label="Troco inicial" value={brl(turno.caixaInicialCentavos)} />
          <Stat label="Vendas" value={resumo ? String(resumo.qtdVendas) : "—"} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <div><p className="text-sm text-muted-foreground">Dinheiro esperado no caixa</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{resumo ? brl(esperado) : "—"}</p></div>
          {!encerrando ? <Button type="button" className="h-11 bg-brand px-6 text-white hover:bg-brand-600"
            onClick={() => setEncerrando(true)} disabled={!resumo || erro}>Fechar caixa</Button> : null}
        </div>
        {carregando && !resumo ? <p className="text-sm text-muted-foreground">Carregando turno…</p> : null}
        {erro ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          <span>Não foi possível atualizar o turno.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void carregar()}><RefreshCw /> Tentar novamente</Button>
        </div> : null}
        {encerrando ? <div className="space-y-5 border-t pt-5">
          <h2 className="text-base font-semibold">Conferência de fechamento</h2>
          <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {resumo?.porForma.filter(([id]) => id !== dinheiroFormaId).map(([id, cents]) => <div key={id} className="flex justify-between gap-3 border-b py-2">
              <span>{rotulos.get(id) ?? `Forma ${id}`}</span><span className="tabular-nums">{brl(cents)}</span>
            </div>)}
            <div className="flex justify-between gap-3 border-b py-2"><span>Troco inicial</span><span className="tabular-nums">{brl(turno.caixaInicialCentavos)}</span></div>
            <div className="flex justify-between gap-3 border-b py-2"><span>Dinheiro das vendas</span><span className="tabular-nums">+{brl(dinheiroVendas)}</span></div>
            <div className="flex justify-between gap-3 border-b py-2"><span>Suprimentos adicionais</span><span className="tabular-nums">+{brl(resumo?.suprimentosCentavos ?? 0)}</span></div>
            <div className="flex justify-between gap-3 border-b py-2"><span>Sangrias</span><span>-{brl(resumo?.sangriasCentavos ?? 0)}</span></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm font-semibold">
            <span>Esperado na gaveta</span><span className="tabular-nums">{resumo ? brl(esperado) : "—"}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="gaveta" className="mb-2">Gaveta</Label>
              <ValorCentavosInput id="gaveta" autoFocus className="h-12 px-4" centavos={gavetaCentavos}
                onCentavosChange={(centavos) => { setGavetaCentavos(centavos); setConferenciaIniciada(true); }} />
            </div>
            <div><Label htmlFor="malote" className="mb-2">Malote</Label>
              <ValorCentavosInput id="malote" className="h-12 px-4" centavos={maloteCentavos}
                onCentavosChange={(centavos) => { setMaloteCentavos(centavos); setConferenciaIniciada(true); }} />
            </div>
          </div>
          {conferenciaIniciada ? <div className="space-y-1 text-sm">
            <p>Total conferido: {brl(totalConferidoCentavos)}</p>
            <p>{diferenca === 0 ? "Confere" : diferenca > 0 ? "Sobra" : "Falta"}: {brl(Math.abs(diferenca))}</p>
          </div> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-10 bg-brand text-white hover:bg-brand-600" onClick={() => void encerrar()}
              disabled={ocupado || !conferenciaIniciada || !resumo || carregando || erro}>Confirmar fechamento</Button>
            <Button type="button" variant="outline" onClick={() => { setEncerrando(false); navigate("/", { replace: true }); }} disabled={ocupado}>Cancelar</Button>
          </div>
        </div> : null}
      </CardContent>
    </Card>

    {!encerrando ? <CaixaMovimentos turnoUid={turno.syncUid} operador={turno.operador} saldo={esperado}
      tipoInicial={tipoInicial} onRegistrar={carregar} /> : null}
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-1 break-words font-semibold tabular-nums">{value}</p></div>;
}
