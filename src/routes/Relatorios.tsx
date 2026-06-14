// Tela Relatórios (US5): login (gate) → emitir relatório de vendas ou estoque.

import { useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EstoqueView, VendasView } from "@/components/RelatoriosViews";
import {
  autenticar,
  relatorioEstoque,
  relatorioVendas,
  type ErroIpc,
  type RelatorioEstoque as REstoque,
  type RelatorioVendas as RVendas,
} from "@/lib/ipc";

const TIPOS = [
  { id: "dia", rotulo: "Relatório dia Inteiro", grupo: "Vendas" },
  { id: "manha", rotulo: "Turma da Manhã", grupo: "Vendas" },
  { id: "tarde", rotulo: "Turma da Tarde", grupo: "Vendas" },
  { id: "estoque", rotulo: "Relatório de Estoque", grupo: "Administrativos" },
];

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function Relatorios() {
  const [tipo, setTipo] = useState("dia");
  const [data, setData] = useState(hojeIso());
  const [usuario, setUsuario] = useState("adm");
  const [senha, setSenha] = useState("");
  const [vendas, setVendas] = useState<RVendas | null>(null);
  const [estoque, setEstoque] = useState<REstoque | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function voltar() {
    setVendas(null);
    setEstoque(null);
  }

  async function emitir() {
    setOcupado(true);
    try {
      const ok = await autenticar(usuario, senha);
      if (!ok) {
        toast.error("Usuário ou senha inválidos");
        return;
      }
      if (tipo === "estoque") {
        setEstoque(await relatorioEstoque());
        setVendas(null);
      } else {
        setVendas(await relatorioVendas(data, tipo));
        setEstoque(null);
      }
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao emitir");
    } finally {
      setOcupado(false);
    }
  }

  if (vendas || estoque) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex gap-2 print:hidden">
          <Button variant="outline" onClick={voltar}>
            ← Voltar
          </Button>
          <Button onClick={() => window.print()} className="ml-auto">
            <Printer size={15} /> Imprimir
          </Button>
        </div>
        {vendas && <VendasView rel={vendas} />}
        {estoque && <EstoqueView rel={estoque} />}
      </div>
    );
  }

  const grupos = [...new Set(TIPOS.map((t) => t.grupo))];

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
      <div className="bg-card mt-4 space-y-4 rounded-xl border p-5">
        {grupos.map((g) => (
          <div key={g}>
            <div className="text-muted-foreground text-[11px] uppercase">
              Relatórios de {g}
            </div>
            <div className="mt-2 space-y-2">
              {TIPOS.filter((t) => t.grupo === g).map((t) => (
                <label
                  key={t.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${
                    tipo === t.id ? "border-[#1f7a4d] bg-[#1f7a4d]/10" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo"
                    checked={tipo === t.id}
                    onChange={() => setTipo(t.id)}
                    className="accent-[#1f7a4d]"
                  />
                  {t.rotulo}
                </label>
              ))}
            </div>
          </div>
        ))}

        {tipo !== "estoque" && (
          <div>
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.currentTarget.value)}
              className="mt-1 h-9"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="user">Usuário</Label>
            <Input
              id="user"
              value={usuario}
              onChange={(e) => setUsuario(e.currentTarget.value)}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label htmlFor="pwd">Senha</Label>
            <Input
              id="pwd"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && emitir()}
              className="mt-1 h-9"
            />
          </div>
        </div>
        <Button
          onClick={emitir}
          disabled={ocupado}
          className="h-9 w-full bg-[#1f7a4d] text-white hover:bg-[#1a6a43]"
        >
          Enviar
        </Button>
        <p className="text-muted-foreground text-[11px]">Padrão inicial: adm / adm.</p>
      </div>
    </div>
  );
}
