import { useEffect, useState, type FormEvent } from "react";
import { ChevronRight, House, Play, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@livraria/ui/wowdash/button";
import { Card, CardContent, CardHeader, CardTitle } from "@livraria/ui/wowdash/card";
import { Label } from "@livraria/ui/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@livraria/ui/wowdash/select";
import { ValorCentavosInput } from "@/components/ValorCentavosInput";
import { listarOperadores, turnoAbrir, type OperadorDto, type TurnoAberto } from "@/lib/ipc";

function message(error: unknown): string {
  if (typeof error === "string") return error;
  return error instanceof Error ? error.message : "Não foi possível abrir o caixa.";
}

export default function AbrirCaixa({ onOpened }: { onOpened: (turno: TurnoAberto) => void }) {
  const navigate = useNavigate();
  const [operadores, setOperadores] = useState<OperadorDto[]>([]);
  const [operador, setOperador] = useState("");
  const [valorCentavos, setValorCentavos] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function carregarOperadores() {
    setCarregando(true);
    try {
      setOperadores(await listarOperadores());
      setErro("");
    } catch (error) { setErro(message(error)); }
    finally { setCarregando(false); }
  }

  useEffect(() => { void carregarOperadores(); }, []);

  async function abrir(event: FormEvent) {
    event.preventDefault();
    if (!operador) {
      setErro("Selecione o usuário e informe um valor inicial válido.");
      return;
    }
    setOcupado(true);
    setErro("");
    try {
      const turno = await turnoAbrir(operador, valorCentavos);
      onOpened(turno);
      navigate("/", { replace: true });
    } catch (error) { setErro(message(error)); }
    finally { setOcupado(false); }
  }

  return <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-6 px-4 py-8 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-2xl font-semibold">Abrir caixa</h1>
      <nav aria-label="Navegação da página" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="flex items-center gap-2 hover:text-brand"><House size={16} /> Início</Link>
        <ChevronRight size={15} aria-hidden="true" />
        <span className="font-medium text-foreground" aria-current="page">Abrir caixa</span>
      </nav>
    </div>
    <Card className="w-full gap-0 rounded-lg py-0">
      <CardHeader className="border-b px-6 py-4">
        <CardTitle className="text-lg font-semibold">Abertura de caixa</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={abrir} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="operador-caixa" className="mb-2">Usuário do turno</Label>
            <Select value={operador} onValueChange={setOperador} disabled={carregando || ocupado}>
              <SelectTrigger id="operador-caixa" className="w-full rounded-lg px-4 data-[size=default]:h-12"><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
              <SelectContent>{operadores.map((item) =>
                <SelectItem key={item.usuario} value={item.usuario}>{item.nome || item.usuario}</SelectItem>)}</SelectContent>
            </Select>
            {!carregando && operadores.length === 0 ? <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void carregarOperadores()}><RefreshCw /> Atualizar usuários</Button> : null}
          </div>
          <div>
            <Label htmlFor="valor-abertura" className="mb-2">Suprimento de troco inicial</Label>
            <ValorCentavosInput id="valor-abertura" className="h-12 rounded-lg px-4" centavos={valorCentavos}
              onCentavosChange={setValorCentavos} disabled={ocupado} />
          </div>
          {erro ? <p role="alert" className="text-sm text-destructive">{erro}</p> : null}
          <div className="pt-1">
            <Button type="submit" className="h-12 bg-brand px-8 text-white hover:bg-brand-600" disabled={ocupado || carregando || !operador}><Play /> Abrir caixa</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>;
}
