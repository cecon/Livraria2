"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileDown, FileSpreadsheet, MessageCircle } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { reais } from "@/utils/texto";
import { StockReportView } from "@/components/StockReportView";
import { downloadStockFile, fetchStockFile, shareStockPdf, type StockFormat } from "@/lib/nuvem/stock-export";
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
  const [exportando, setExportando] = useState(false);
  const [pdfParaCompartilhar, setPdfParaCompartilhar] = useState<File | null>(null);

  useEffect(() => {
    if (!estoque) { setPdfParaCompartilhar(null); return; }
    let current = true;
    setPdfParaCompartilhar(null);
    fetchStockFile("pdf").then((file) => { if (current) setPdfParaCompartilhar(file); }).catch(() => {});
    return () => { current = false; };
  }, [estoque]);

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

  async function exportarEstoque(formato: StockFormat) {
    setExportando(true);
    try { downloadStockFile(await fetchStockFile(formato)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Falha na exportação."); }
    finally { setExportando(false); }
  }

  async function compartilharEstoque() {
    setExportando(true);
    try {
      const result = await shareStockPdf(pdfParaCompartilhar ?? undefined);
      if (result === "downloaded") toast.info("PDF baixado. Anexe o arquivo no WhatsApp.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao gerar PDF."); }
    finally { setExportando(false); }
  }

  function exportarExcel() {
    if (vendas) baixarCSV(`vendas-${vendas.data}.csv`, csvVendas(vendas));
    else if (dest) baixarCSV(`destinacoes-${dest.inicio}.csv`, csvDestinacoes(dest));
  }
  function exportarWhatsApp() {
    if (vendas) compartilharWhatsApp(txtVendas(vendas));
    else if (dest) compartilharWhatsApp(txtDestinacoes(dest));
  }

  if (vendas || estoque || dest) {
    return (
      <div className={`mx-auto px-4 py-4 sm:p-6 ${estoque ? "max-w-7xl" : "max-w-3xl"}`}>
        <div className="mb-4 flex flex-nowrap items-center gap-2 print:hidden">
          <Button variant="outline" onClick={voltar} aria-label="Voltar aos relatórios" title="Voltar aos relatórios"
            className="h-11 w-11 px-0 sm:h-8 sm:w-auto sm:px-2.5">
            <ArrowLeft size={16} aria-hidden="true" /><span className="hidden sm:inline">Voltar</span>
          </Button>
          <Button variant="outline" className="ml-auto h-11 w-11 px-0 sm:h-8 sm:w-auto sm:px-2.5"
            aria-label="Baixar Excel" disabled={exportando}
            onClick={estoque ? () => exportarEstoque("xlsx") : exportarExcel}
            title={estoque ? "Baixar planilha Excel" : "Baixar em Excel (CSV)"}>
            <FileSpreadsheet size={16} aria-hidden="true" /><span className="hidden sm:inline">Excel</span>
          </Button>
          <Button variant="outline" className="h-11 w-11 px-0 sm:h-8 sm:w-auto sm:px-2.5"
            aria-label="Baixar PDF" disabled={exportando}
            onClick={estoque ? () => exportarEstoque("pdf") : () => window.print()}
            title={estoque ? "Baixar PDF" : "Imprimir ou salvar em PDF"}>
            <FileDown size={16} aria-hidden="true" /><span className="hidden sm:inline">PDF</span>
          </Button>
          <Button variant="outline" className="h-11 px-2.5 sm:h-8" disabled={exportando}
            onClick={estoque ? compartilharEstoque : exportarWhatsApp}
            title={estoque ? "Compartilhar PDF pelo celular" : "Compartilhar resumo por WhatsApp"}>
            <MessageCircle size={16} aria-hidden="true" /> WhatsApp
          </Button>
        </div>
        {vendas && <VendasView rel={vendas} />}
        {estoque && <StockReportView report={estoque} />}
        {dest && <DestinacoesView rel={dest} />}
      </div>
    );
  }

  const grupos = [...new Set(TIPOS.map((t) => t.grupo))];

  return (
    <div className="mx-auto max-w-md px-4 py-4 sm:p-6">
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
          <div className={tipo === "destinacoes" ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : ""}>
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
                <li key={k} className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
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

function DestinacoesView({ rel }: { rel: RelatorioDestinacoes }) {
  return (
    <div className="bg-card rounded-xl border p-5">
      <h2 className="text-lg font-semibold">Vendas por Destinação</h2>
      <p className="text-muted-foreground text-sm">{rel.inicio === rel.fim ? rel.inicio : `${rel.inicio} a ${rel.fim}`}</p>
      <div className="overflow-x-auto">
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
    </div>
  );
}
