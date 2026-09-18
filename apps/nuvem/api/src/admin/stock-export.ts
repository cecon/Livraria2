import { Workbook } from "exceljs";
import PDFDocument from "pdfkit";
import type { ReportsService } from "./reports.service";

type StockReport = Awaited<ReturnType<ReportsService["stock"]>>;
type StockItem = StockReport["itens"][number];
const categoryNames = ["Não Categorizado", "Bíblias", "Infantil", "Família",
  "Devocional", "Estudo & Teologia", "Ficção"];
const categoryName = (id: number) => categoryNames[id] ?? `Categoria ${id}`;

const money = (cents: number) => {
  const sign = cents < 0 ? "-" : "";
  const value = Math.abs(cents);
  return `${sign}R$ ${Math.trunc(value / 100).toLocaleString("pt-BR")},${String(value % 100).padStart(2, "0")}`;
};

export async function stockWorkbook(report: StockReport): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Estoque", { views: [{ state: "frozen", ySplit: 4 }] });
  sheet.columns = [
    { key: "codigo", width: 20 }, { key: "titulo", width: 55 },
    { key: "categoria", width: 24 }, { key: "preco", width: 18 },
    { key: "estoque", width: 12 }, { key: "valor", width: 20 },
    { key: "precoCentavos", width: 20, hidden: true },
    { key: "valorCentavos", width: 20, hidden: true },
  ];
  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = "Relatório de estoque";
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.mergeCells("A2:F2");
  sheet.getCell("A2").value = `${report.titulos} títulos | Valor em estoque: ${money(report.valorTotalCentavos)}`;
  sheet.addRow([]);
  const header = sheet.addRow(["Código", "Título", "Categoria", "Preço", "Estoque", "Valor", "Preço (centavos)", "Valor (centavos)"]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F714E" } };
  for (const item of report.itens) {
    sheet.addRow([item.codigo, item.titulo, categoryName(item.categoria), money(item.precoCentavos),
      item.estoque, money(item.valorCentavos), item.precoCentavos, item.valorCentavos]);
  }
  sheet.autoFilter = { from: "A4", to: `F${Math.max(4, 4 + report.itens.length)}` };
  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}

function drawHeader(doc: PDFKit.PDFDocument, report: StockReport, generatedAt: string) {
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#17212d")
    .text("Relatório de estoque", 40, 35);
  doc.font("Helvetica").fontSize(9).fillColor("#536273")
    .text(`${report.titulos} títulos  |  Valor: ${money(report.valorTotalCentavos)}  |  ${generatedAt}`, 40, 60);
  const labels = ["Código", "Título", "Categoria", "Preço", "Qtd.", "Valor"];
  const x = [40, 140, 449, 530, 607, 660];
  doc.rect(40, 83, 762, 25).fill("#edf3f1");
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#17212d");
  labels.forEach((label, index) => doc.text(label, x[index], 91, {
    width: index === 1 ? 300 : index === 5 ? 130 : 90,
  }));
}

function drawItem(doc: PDFKit.PDFDocument, item: StockItem, y: number, height: number) {
  const values = [item.codigo, item.titulo, categoryName(item.categoria), money(item.precoCentavos),
    String(item.estoque), money(item.valorCentavos)];
  const x = [40, 140, 449, 530, 607, 660];
  const widths = [94, 300, 74, 70, 45, 130];
  doc.font("Helvetica").fontSize(8).fillColor("#17212d");
  values.forEach((value, index) => doc.text(value, x[index], y + 6, {
    width: widths[index], lineBreak: false, ellipsis: index !== 1,
  }));
  doc.moveTo(40, y + height).lineTo(802, y + height).lineWidth(0.5).strokeColor("#dce4e3").stroke();
}

export function stockPdf(report: StockReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short",
      timeZone: "America/Sao_Paulo" }).format(new Date());
    doc.addPage();
    drawHeader(doc, report, generatedAt);
    let y = 108;
    for (const item of report.itens) {
      const height = Math.max(23, doc.font("Helvetica").fontSize(8)
        .heightOfString(item.titulo, { width: 300 }) + 12,
      doc.heightOfString(categoryName(item.categoria), { width: 74 }) + 12);
      if (y + height > 540) {
        doc.addPage();
        drawHeader(doc, report, generatedAt);
        y = 108;
      }
      drawItem(doc, item, y, height);
      y += height;
    }
    doc.end();
  });
}
