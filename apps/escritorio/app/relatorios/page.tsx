"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, MessageCircle, Printer } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { CATEGORIAS } from "@/lib/catalogo";
import { reais } from "@/utils/texto";
import {
  relatorioVendas,
  relatorioEstoque,
  relatorioDestinacoes,
  type RelatorioVendas,
  type RelatorioEstoque,
  type RelatorioDestinacoes,
} from "@/lib/nuvem/relatorios";
import {
  baixarCSV,
  compartilharWhatsApp,
  csvVendas,
  txtVendas,
  csvEstoque,
  txtEstoque,
  csvDestinacoes,
  txtDestinacoes,
} from "@/lib/nuvem/exportar";

const TIPOS = [
  { id: "dia", rotulo: "Relatório dia Inteiro", grupo: "Vendas" },
  { id: "manha", rotulo: "Turma da Manhã", grupo: "Vendas" },
  { id: "tarde", rotulo: "Turma da Tarde", grupo: "Vendas" },
  { id: "estoque", rotulo: "Relatório de Estoque", grupo: "Administrativos" },
  { id: "destinacoes", rotulo: "Vendas por Destinação", grupo: "Administrativos" },
];
const PERIODO_ROTULO: Record<string, string> = { dia: "Dia Inteiro", manha: "Turma da Manhã", tarde: "Turma da Tarde" };

const hojeIso = () => new Date().toISOString().slice(0, 10);

export default function RelatoriosPage() {
  const [tipo, setTipo] = useState("dia");
  const [data, setData] = useState(hojeIso());
  const [dataFim, setDataFim] = useState(hojeIso());
  const [vendas, setVendas] = useState<RelatorioVendas | null>(null);
  const [estoque, setEstoque] = useState<RelatorioEstoque | null>(null);
  const [dest, setDest] = useState<RelatorioDestinacoes | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function voltar() {
    setVendas(null);
    setEstoque(null);
    setDest(null);
  }

  async function emitir() {
    setOcupado(true);
    try {
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
    } catch {
      toast.error("Erro ao emitir");
    } finally {
      setOcupado(false);
    }
  }

  function exportarExcel() {
    if (vendas) baixarCSV(`vendas-${vendas.data}.csv`, csvVendas(vendas));
    else if (estoque) baixarCSV(`estoque-${hojeIso()}.csv`, csvEstoque(estoque));
    else if (dest) baixarCSV(`destinacoes-${dest.inicio}.csv`, csvDestinacoes(dest));
  }
  function exportarWhatsApp() {
    if (vendas) compartilharWhatsApp(txtVendas(vendas));
    else if (estoque) compartilharWhatsApp(txtEstoque(estoque));
    else if (dest) compartilharWhatsApp(txtDestinacoes(dest));
  }

  if (vendas || estoque || dest) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" onClick={voltar}>← Voltar</Button>
          <Button variant="outline" className="ml-auto" onClick={exportarExcel} title="Baixar em Excel (CSV)">
            <FileSpreadsheet size={15} /> Excel
          </Button>
          <Button variant="outline" onClick={() => window.print()} title="Imprimir ou salvar em PDF">
            <Printer size={15} /> PDF
          </Button>
          <Button variant="outline" onClick={exportarWhatsApp} title="Compartilhar resumo por WhatsApp">
            <MessageCircle size={15} /> WhatsApp
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
            <div className="text-muted-foreground text-[11px] uppercase">Relatórios de {g}</div>
            <div className="mt-2 space-y-2">
              {TIPOS.filter((t) => t.grupo === g).map((t) => (
                <label key={t.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${tipo === t.id ? "border-[#1f7a4d] bg-[#1f7a4d]/10" : ""}`}>
                  <input type="radio" name="tipo" checked={tipo === t.id} onChange={() => setTipo(t.id)} className="accent-[#1f7a4d]" />
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
              <Input id="data" type="date" value={data} onChange={(e) => setData(e.currentTarget.value)} className="mt-1 h-9" />
            </div>
            {tipo === "destinacoes" && (
              <div>
                <Label htmlFor="dataFim">Até</Label>
                <Input id="dataFim" type="date" value={dataFim} onChange={(e) => setDataFim(e.currentTarget.value)} className="mt-1 h-9" />
              </div>
            )}
          </div>
        )}

        <Button onClick={emitir} disabled={ocupado} className="h-9 w-full bg-[#1f7a4d] text-white hover:bg-[#1a6a43]">Emitir</Button>
      </div>
    </div>
  );
}

function VendasView({ rel }: { rel: RelatorioVendas }) {
  const ativos = rel.pedidos.filter((p) => !p.cancelado);
  const canceladas = rel.pedidos.filter((p) => p.cancelado);
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Relatório de Vendas — {PERIODO_ROTULO[rel.periodo] ?? rel.periodo} — {rel.data}</h2>
      {ativos.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma venda no período.</p>
      ) : (
        ativos.map((p) => {
          const pago = p.recebimentos.reduce((s, r) => s + r.valorCentavos, 0);
          const divergente = pago !== p.totalCentavos;
          return (
            <div key={p.numero} className={`rounded-lg border p-3 text-sm ${divergente ? "border-rose-500 ring-1 ring-rose-500" : ""}`}>
              <div className="flex items-center justify-between font-medium">
                <span>Pedido Nº {p.numero} · {p.cliente}</span>
                {divergente && <span className="text-[11px] font-normal text-rose-600">⚠ Pago {reais(pago)} ≠ Total {reais(p.totalCentavos)}</span>}
              </div>
              <ul className="text-muted-foreground mt-1">
                {p.itens.map((i, k) => (
                  <li key={k} className="flex items-center gap-2 font-mono text-[12px]">
                    <span className="flex-1">{i.qtd}× {i.titulo}</span>
                    <span>{reais(i.valorCentavos)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 font-mono text-[12px] text-[#1f7a4d]">
                {p.recebimentos.map((r, k) => (
                  <span key={k}>{r.rotulo} {reais(r.valorCentavos)}</span>
                ))}
                <span className="ml-auto font-semibold">Total {reais(p.totalCentavos)}</span>
              </div>
            </div>
          );
        })
      )}

      {canceladas.length > 0 && (
        <div className="rounded-lg border border-dashed p-3 text-sm">
          <div className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase">Canceladas (não somadas) — {canceladas.length}</div>
          <ul className="space-y-1 font-mono text-[12px]">
            {canceladas.map((p) => (
              <li key={p.numero} className="text-muted-foreground flex justify-between">
                <span>Nº {p.numero} · {p.cliente}</span>
                <span className="line-through">{reais(p.totalCentavos)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-muted/40 rounded-lg p-4">
        <div className="mb-2 text-sm font-semibold">Resumo das Vendas</div>
        <div className="space-y-1 font-mono text-sm">
          {rel.resumo.formas.map((f, k) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted-foreground">Total {f.rotulo}</span>
              <span>{reais(f.valorCentavos)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t pt-2 font-mono text-base font-bold">
          <span>Total das Vendas (todas as formas)</span>
          <span>{reais(rel.resumo.subtotalCentavos)}</span>
        </div>
      </div>
    </div>
  );
}

function EstoqueView({ rel }: { rel: RelatorioEstoque }) {
  const cat = (id: number) => CATEGORIAS.find((c) => c.id === id)?.nome ?? String(id);
  return (
    <div>
      <h2 className="text-lg font-semibold">Relatório de Estoque</h2>
      <p className="text-muted-foreground text-sm">{rel.titulos} títulos · Valor em estoque: {reais(rel.valorTotalCentavos)}</p>
      <table className="mt-3 w-full text-sm">
        <thead className="text-muted-foreground text-[11px] uppercase">
          <tr className="border-b text-left">
            <th className="py-1">Código</th>
            <th>Título</th>
            <th>Categoria</th>
            <th className="text-right">Preço</th>
            <th className="text-right">Estoque</th>
            <th className="text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rel.itens.map((i) => (
            <tr key={i.codigo} className="border-b">
              <td className="py-1 font-mono text-[12px]">{i.codigo}</td>
              <td className="max-w-[220px] truncate">{i.titulo}</td>
              <td className="text-[12px]">{cat(i.categoria)}</td>
              <td className="text-right font-mono">{reais(i.precoCentavos)}</td>
              <td className="text-right font-mono">{i.estoque}</td>
              <td className="text-right font-mono">{reais(i.valorCentavos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DestinacoesView({ rel }: { rel: RelatorioDestinacoes }) {
  return (
    <div className="bg-card rounded-xl border p-5">
      <h2 className="text-lg font-semibold">Vendas por Destinação</h2>
      <p className="text-muted-foreground text-sm">{rel.inicio === rel.fim ? rel.inicio : `${rel.inicio} a ${rel.fim}`}</p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-[11px] uppercase">
            <th className="py-1.5">Destinação</th>
            <th className="py-1.5 text-right">Unidades</th>
            <th className="py-1.5 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rel.linhas.map((l, k) => (
            <tr key={k} className="border-b last:border-0">
              <td className="py-1.5">{l.nome}</td>
              <td className="py-1.5 text-right font-mono">{l.qtd}</td>
              <td className="py-1.5 text-right font-mono">{reais(l.valorCentavos)}</td>
            </tr>
          ))}
          {rel.linhas.length === 0 && (
            <tr><td colSpan={3} className="text-muted-foreground py-4 text-center">Nada no período.</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-2">Total</td>
            <td />
            <td className="py-2 text-right font-mono">{reais(rel.totalCentavos)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
