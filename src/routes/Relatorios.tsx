// Tela Relatórios (US5): login (gate) → emitir relatório de vendas ou estoque.

import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  exportarEstoqueExcel,
  exportarVendasExcel,
  exportarVendasPdf,
  whatsappEstoque,
  whatsappVendas,
} from "@/lib/exportar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DestinacoesView, EstoqueView, VendasView } from "@/components/RelatoriosViews";
import {
  autenticar,
  relatorioDestinacoes,
  relatorioEstoque,
  relatorioVendas,
  type ErroIpc,
  type RelatorioEstoque as REstoque,
  type RelatorioVendas as RVendas,
} from "@/lib/ipc";
import type { RelatorioDestinacoes as RDest } from "@/lib/types";

const TIPOS = [
  { id: "dia", rotulo: "Relatório dia Inteiro", grupo: "Vendas" },
  { id: "manha", rotulo: "Turma da Manhã", grupo: "Vendas" },
  { id: "tarde", rotulo: "Turma da Tarde", grupo: "Vendas" },
  { id: "estoque", rotulo: "Relatório de Estoque", grupo: "Administrativos" },
  { id: "destinacoes", rotulo: "Vendas por Destinação", grupo: "Administrativos" },
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
  const [dest, setDest] = useState<RDest | null>(null);
  const [dataFim, setDataFim] = useState(hojeIso());
  const [ocupado, setOcupado] = useState(false);

  function voltar() {
    setVendas(null);
    setEstoque(null);
    setDest(null);
  }

  async function exportarExcel() {
    try {
      const ok = vendas
        ? await exportarVendasExcel(vendas)
        : estoque
          ? await exportarEstoqueExcel(estoque)
          : false;
      if (ok) toast.success("Excel exportado");
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao exportar");
    }
  }

  function compartilharWhats() {
    if (vendas) void whatsappVendas(vendas);
    else if (estoque) void whatsappEstoque(estoque);
  }

  async function exportarPdf() {
    if (!vendas) return;
    try {
      if (await exportarVendasPdf(vendas)) toast.success("PDF exportado");
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao exportar PDF");
    }
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
        setDest(null);
      } else if (tipo === "destinacoes") {
        setDest(await relatorioDestinacoes(data, dataFim));
        setVendas(null);
        setEstoque(null);
      } else {
        setVendas(await relatorioVendas(data, tipo));
        setEstoque(null);
        setDest(null);
      }
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao emitir");
    } finally {
      setOcupado(false);
    }
  }

  if (vendas || estoque || dest) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex gap-2 print:hidden">
          <Button variant="outline" onClick={voltar}>
            ← Voltar
          </Button>
          <Button variant="outline" onClick={exportarExcel} className="ml-auto">
            <FileSpreadsheet size={15} /> Excel
          </Button>
          {vendas && (
            <Button variant="outline" onClick={exportarPdf}>
              <FileText size={15} /> PDF
            </Button>
          )}
          <Button
            onClick={compartilharWhats}
            className="bg-[#25D366] text-white hover:bg-[#1ebe5d]"
            title="Compartilhar resumo no WhatsApp"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.2-.2.3-.7.8-.9 1-.2.2-.3.2-.6.1-1.5-.7-2.5-1.3-3.5-3-.3-.5.3-.4.8-1.4.1-.2 0-.3 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.2.2 2.1 3.3 5.2 4.6 3.1 1.2 3.1.8 3.7.8.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.6 1.4 5.1L2 22l5-1.3c1.5.8 3.2 1.3 5 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
            </svg>
            WhatsApp
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer size={15} /> Imprimir
          </Button>
        </div>
        {vendas && <VendasView rel={vendas} />}
        {estoque && <EstoqueView rel={estoque} />}
        {dest && <DestinacoesView rel={dest} />}
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
          <div className={tipo === "destinacoes" ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <Label htmlFor="data">{tipo === "destinacoes" ? "De" : "Data"}</Label>
              <Input
                id="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.currentTarget.value)}
                className="mt-1 h-9"
              />
            </div>
            {tipo === "destinacoes" && (
              <div>
                <Label htmlFor="dataFim">Até</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.currentTarget.value)}
                  className="mt-1 h-9"
                />
              </div>
            )}
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
