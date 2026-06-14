// Exportação de relatórios para Excel (.xlsx) e compartilhamento via WhatsApp.

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { brl } from "./format";
import { CATEGORIAS } from "./types";
import type { RelatorioEstoque, RelatorioVendas } from "./ipc";

async function salvarBytes(
  nome: string,
  bytes: Uint8Array,
  filtro: string,
  ext: string,
): Promise<boolean> {
  const caminho = await save({
    defaultPath: nome,
    filters: [{ name: filtro, extensions: [ext] }],
  });
  if (!caminho) return false;
  await invoke("salvar_arquivo", { caminho, conteudo: Array.from(bytes) });
  return true;
}

async function salvarPlanilha(wb: XLSX.WorkBook, nome: string): Promise<boolean> {
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return salvarBytes(nome, new Uint8Array(buf), "Excel", "xlsx");
}

export async function exportarVendasPdf(rel: RelatorioVendas): Promise<boolean> {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(`Relatório de Vendas — ${rel.data}`, 14, 16);
  autoTable(doc, {
    startY: 22,
    styles: { fontSize: 8 },
    head: [["Pedido", "Cliente", "Cartão", "Dinheiro", "PIX", "Min.", "Vale", "Total"]],
    body: rel.pedidos.map((p) => [
      p.numero,
      p.cliente,
      brl(p.cartao),
      brl(p.dinheiro),
      brl(p.pix),
      brl(p.ministerio),
      brl(p.vale),
      brl(p.totalCentavos),
    ]),
  });
  const r = rel.resumo;
  autoTable(doc, {
    styles: { fontSize: 9 },
    head: [["Resumo das Vendas", "Valor"]],
    body: [
      ["Cartão", brl(r.cartao)],
      ["Dinheiro", brl(r.dinheiro)],
      ["PIX", brl(r.pix)],
      ["Ministério", brl(r.ministerio)],
      ["Vale Presente", brl(r.vale)],
      ["TOTAL", brl(r.subtotalCentavos)],
    ],
  });
  const bytes = new Uint8Array(doc.output("arraybuffer"));
  return salvarBytes(`relatorio-vendas-${rel.data}.pdf`, bytes, "PDF", "pdf");
}

export async function exportarVendasExcel(rel: RelatorioVendas): Promise<boolean> {
  const pagamentos = rel.pedidos.map((p) => ({
    Pedido: p.numero,
    Cliente: p.cliente,
    Cartão: p.cartao / 100,
    Dinheiro: p.dinheiro / 100,
    PIX: p.pix / 100,
    Ministério: p.ministerio / 100,
    "Vale Presente": p.vale / 100,
    Total: p.totalCentavos / 100,
  }));
  const itens = rel.pedidos.flatMap((p) =>
    p.itens.map((i) => ({
      Pedido: p.numero,
      Item: i.titulo,
      Qtd: i.qtd,
      Valor: i.valorCentavos / 100,
    })),
  );
  const resumo = [
    { Forma: "Cartão", Valor: rel.resumo.cartao / 100 },
    { Forma: "Dinheiro", Valor: rel.resumo.dinheiro / 100 },
    { Forma: "PIX", Valor: rel.resumo.pix / 100 },
    { Forma: "Ministério", Valor: rel.resumo.ministerio / 100 },
    { Forma: "Vale Presente", Valor: rel.resumo.vale / 100 },
    { Forma: "TOTAL", Valor: rel.resumo.subtotalCentavos / 100 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pagamentos), "Pagamentos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itens), "Itens");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");
  return salvarPlanilha(wb, `relatorio-vendas-${rel.data}.xlsx`);
}

export async function exportarEstoqueExcel(rel: RelatorioEstoque): Promise<boolean> {
  const nomeCat = (id: number) =>
    CATEGORIAS.find((c) => c.id === id)?.nome ?? String(id);
  const linhas = rel.itens.map((i) => ({
    Código: i.codigo,
    Título: i.titulo,
    Categoria: nomeCat(i.categoria),
    Preço: i.precoCentavos / 100,
    Estoque: i.estoque,
    Valor: i.valorCentavos / 100,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Estoque");
  return salvarPlanilha(wb, "relatorio-estoque.xlsx");
}

export async function whatsappVendas(rel: RelatorioVendas): Promise<void> {
  const r = rel.resumo;
  const texto = [
    `*Relatório de Vendas* — ${rel.data}`,
    `Cartão: ${brl(r.cartao)}`,
    `Dinheiro: ${brl(r.dinheiro)}`,
    `PIX: ${brl(r.pix)}`,
    `Ministério: ${brl(r.ministerio)}`,
    `Vale Presente: ${brl(r.vale)}`,
    `*Total: ${brl(r.subtotalCentavos)}*`,
  ].join("\n");
  await openUrl(`https://wa.me/?text=${encodeURIComponent(texto)}`);
}

export async function whatsappEstoque(rel: RelatorioEstoque): Promise<void> {
  const texto = `*Relatório de Estoque* — ${rel.titulos} títulos · Valor em estoque: ${brl(
    rel.valorTotalCentavos,
  )}`;
  await openUrl(`https://wa.me/?text=${encodeURIComponent(texto)}`);
}
