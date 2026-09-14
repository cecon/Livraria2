// Exportação de relatórios para Excel (.xlsx) e compartilhamento via WhatsApp.

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { brl } from "./format";
import { CATEGORIAS, type RelatorioSessao } from "./types";
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
  return p.recebimentos
    .map((r) => `${r.rotulo} ${brl(r.valorCentavos)}`)
    .join("   ");
}

export async function exportarVendasPdf(rel: RelatorioVendas): Promise<boolean> {
  const doc = new jsPDF();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = () => (doc as any).lastAutoTable.finalY as number;
  doc.setFontSize(14);
  doc.text(`Relatório de Vendas — ${rel.data}`, 14, 14);
  let y = 20;

  for (const p of rel.pedidos.filter((x) => !x.cancelado)) {
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
      ...r.formas.map((f) => [f.rotulo, brl(f.totalCentavos)]),
      ["TOTAL DAS VENDAS", brl(r.subtotalCentavos)],
    ],
    columnStyles: { 1: { halign: "right" } },
  });

  // Seção de canceladas (não somadas), para conferência do ajuste.
  const canceladas = rel.pedidos.filter((p) => p.cancelado);
  if (canceladas.length > 0) {
    autoTable(doc, {
      startY: finalY() + 6,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [120, 120, 120] },
      head: [["Canceladas (não somadas)", "Cliente", "Total"]],
      body: canceladas.map((p) => [`Nº ${p.numero}`, p.cliente, brl(p.totalCentavos)]),
      columnStyles: { 2: { halign: "right" } },
    });
  }

  const bytes = new Uint8Array(doc.output("arraybuffer"));
  return salvarBytes(`relatorio-vendas-${rel.data}.pdf`, bytes, "PDF", "pdf");
}

/** PDF imprimível de um inventário realizado (US3): resumo + itens + pendências. */
export async function exportarInventarioPdf(rel: RelatorioSessao): Promise<boolean> {
  const { sessao: s, resumo: r, itens, pendencias } = rel;
  const doc = new jsPDF();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = () => (doc as any).lastAutoTable.finalY as number;
  const sinal = (n: number) => (n > 0 ? `+${n}` : String(n));

  doc.setFontSize(14);
  doc.text(
    `Inventário ${s.modo === "total" ? "total" : "parcial"}${s.rotulo ? ` · ${s.rotulo}` : ""}`,
    14,
    14,
  );
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `Status: ${s.status} · Aberto: ${s.abertaEm}${s.fechadaEm ? ` · Fechado: ${s.fechadaEm}` : ""}`,
    14,
    20,
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 26,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9, halign: "center" },
    headStyles: { fillColor: [31, 122, 77] },
    head: [["Inventariados", "Bateram", "Faltaram", "Sobraram", "Soma das dif."]],
    body: [[r.total, r.bateram, r.faltaram, r.sobraram, sinal(r.somaDiferencas)]],
  });

  autoTable(doc, {
    startY: finalY() + 4,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 122, 77] },
    head: [["Código", "Livro", "Sistema", "Contado", "Diferença"]],
    body: itens.map((i) => [
      i.codigo,
      i.titulo,
      i.qtdSistema,
      i.qtdContada,
      sinal(i.diferenca),
    ]),
    columnStyles: {
      0: { cellWidth: 30 },
      2: { halign: "right", cellWidth: 22 },
      3: { halign: "right", cellWidth: 22 },
      4: { halign: "right", cellWidth: 24 },
    },
  });

  if (pendencias.length > 0) {
    autoTable(doc, {
      startY: finalY() + 4,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
      headStyles: { fillColor: [120, 120, 120] },
      head: [["Pendência — código lido", "Qtd", "Situação"]],
      body: pendencias.map((p) => [p.codigoLido, p.qtd, p.resolvida ? "resolvida" : "pendente"]),
      columnStyles: { 1: { halign: "right", cellWidth: 20 } },
    });
  }

  const bytes = new Uint8Array(doc.output("arraybuffer"));
  return salvarBytes(`inventario-${s.id}.pdf`, bytes, "PDF", "pdf");
}

export async function exportarVendasExcel(rel: RelatorioVendas): Promise<boolean> {
  const ativos = rel.pedidos.filter((p) => !p.cancelado);
  const canceladas = rel.pedidos.filter((p) => p.cancelado);
  // Uma coluna por forma do cadastro (na ordem do resumo), zeros incluídos.
  const pagamentos = ativos.map((p) => {
    const linha: Record<string, number | string> = {
      Pedido: p.numero,
      Cliente: p.cliente,
    };
    for (const f of rel.resumo.formas) {
      const r = p.recebimentos.find((x) => x.formaId === f.formaId);
      linha[f.rotulo] = (r?.valorCentavos ?? 0) / 100;
    }
    linha.Total = p.totalCentavos / 100;
    return linha;
  });
  const itens = ativos.flatMap((p) =>
    p.itens.map((i) => ({
      Pedido: p.numero,
      Item: i.titulo,
      Qtd: i.qtd,
      Valor: i.valorCentavos / 100,
    })),
  );
  const resumo = [
    ...rel.resumo.formas.map((f) => ({ Forma: f.rotulo, Valor: f.totalCentavos / 100 })),
    { Forma: "TOTAL", Valor: rel.resumo.subtotalCentavos / 100 },
  ];
  // Aba "Detalhado": cada pedido com seus livros + formas + total (igual à tela).
  const det: (string | number)[][] = [];
  for (const p of ativos) {
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
  if (canceladas.length > 0) {
    const canc = canceladas.map((p) => ({
      Pedido: p.numero,
      Cliente: p.cliente,
      Total: p.totalCentavos / 100,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(canc), "Canceladas");
  }
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
    ...r.formas.map((f) => `${f.rotulo}: ${brl(f.totalCentavos)}`),
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
