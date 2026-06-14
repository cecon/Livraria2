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

function formasDoPedido(p: RelatorioVendas["pedidos"][number]): string {
  const fs: string[] = [];
  if (p.cartao > 0) fs.push(`Cartão ${brl(p.cartao)}`);
  if (p.pix > 0) fs.push(`PIX ${brl(p.pix)}`);
  if (p.dinheiro > 0) fs.push(`Dinheiro ${brl(p.dinheiro)}`);
  if (p.ministerio > 0) fs.push(`Ministério ${brl(p.ministerio)}`);
  if (p.vale > 0) fs.push(`Vale ${brl(p.vale)}`);
  return fs.join("   ");
}

export async function exportarVendasPdf(rel: RelatorioVendas): Promise<boolean> {
  const doc = new jsPDF();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = () => (doc as any).lastAutoTable.finalY as number;
  doc.setFontSize(14);
  doc.text(`Relatório de Vendas — ${rel.data}`, 14, 14);
  let y = 20;

  for (const p of rel.pedidos) {
    if (y > 262) {
      doc.addPage();
      y = 14;
    }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Pedido Nº ${p.numero} · ${p.cliente}`, 14, y);
    doc.setFont("helvetica", "normal");
    autoTable(doc, {
      startY: y + 2,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
      headStyles: { fillColor: [31, 122, 77] },
      head: [["Qtd", "Título", "Valor"]],
      body: p.itens.map((i) => [i.qtd, i.titulo, brl(i.valorCentavos)]),
      columnStyles: {
        0: { cellWidth: 14 },
        2: { halign: "right", cellWidth: 28 },
      },
    });
    y = finalY();
    doc.setFontSize(8);
    doc.text(formasDoPedido(p), 14, y + 4);
    doc.setFont("helvetica", "bold");
    doc.text(`Total ${brl(p.totalCentavos)}`, 196, y + 4, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 10;
  }

  const r = rel.resumo;
  if (y > 240) {
    doc.addPage();
    y = 14;
  }
  autoTable(doc, {
    startY: y + 2,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9 },
    head: [["Resumo das Vendas", "Valor"]],
    body: [
      ["Cartão", brl(r.cartao)],
      ["Dinheiro", brl(r.dinheiro)],
      ["PIX", brl(r.pix)],
      ["Ministério", brl(r.ministerio)],
      ["Vale Presente", brl(r.vale)],
      ["TOTAL DAS VENDAS", brl(r.subtotalCentavos)],
    ],
    columnStyles: { 1: { halign: "right" } },
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
  // Aba "Detalhado": cada pedido com seus livros + formas + total (igual à tela).
  const det: (string | number)[][] = [];
  for (const p of rel.pedidos) {
    det.push([`Pedido Nº ${p.numero} · ${p.cliente}`]);
    det.push(["Qtd", "Título", "Valor"]);
    for (const i of p.itens) det.push([i.qtd, i.titulo, i.valorCentavos / 100]);
    det.push(["", "Formas", formasDoPedido(p) || "—"]);
    det.push(["", "Total", p.totalCentavos / 100]);
    det.push([]);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(det), "Detalhado");
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
