// Exportação de relatórios (feature 009, US4) — Excel (CSV UTF-8, sep ";" para o
// Excel pt-BR), PDF (impressão) e WhatsApp (resumo por link). Sem dependência nova
// e sem endpoint/service_role — geração 100% no cliente sobre os dados já emitidos.
"use client";

import { reais } from "@/utils/texto";
import type { RelatorioVendas, RelatorioEstoque, RelatorioDestinacoes } from "@/lib/nuvem/relatorios";

const PERIODO: Record<string, string> = { dia: "Dia Inteiro", manha: "Turma da Manhã", tarde: "Turma da Tarde" };

export function baixarCSV(nomeArquivo: string, linhas: (string | number)[][]): void {
  const csv = linhas
    .map((l) => l.map(escaparCSV).join(";"))
    .join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

function escaparCSV(celula: string | number): string {
  const s = String(celula);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function compartilharWhatsApp(texto: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
}

// ---- Vendas ----
export function csvVendas(rel: RelatorioVendas): (string | number)[][] {
  const linhas: (string | number)[][] = [["Forma", "Valor"]];
  rel.resumo.formas.forEach((f) => linhas.push([f.rotulo, reais(f.valorCentavos)]));
  linhas.push(["Total das Vendas", reais(rel.resumo.subtotalCentavos)]);
  return linhas;
}
export function txtVendas(rel: RelatorioVendas): string {
  const cab = `*Relatório de Vendas* — ${PERIODO[rel.periodo] ?? rel.periodo} — ${rel.data}`;
  const formas = rel.resumo.formas.map((f) => `${f.rotulo}: ${reais(f.valorCentavos)}`).join("\n");
  return `${cab}\n${formas}\n*Total: ${reais(rel.resumo.subtotalCentavos)}*`;
}

// ---- Estoque ----
export function csvEstoque(rel: RelatorioEstoque): (string | number)[][] {
  const linhas: (string | number)[][] = [["Código", "Título", "Preço", "Estoque", "Valor"]];
  rel.itens.forEach((i) => linhas.push([i.codigo, i.titulo, reais(i.precoCentavos), i.estoque, reais(i.valorCentavos)]));
  linhas.push(["", "", "", "Total", reais(rel.valorTotalCentavos)]);
  return linhas;
}
export function txtEstoque(rel: RelatorioEstoque): string {
  return `*Relatório de Estoque*\n${rel.titulos} títulos\n*Valor em estoque: ${reais(rel.valorTotalCentavos)}*`;
}

// ---- Destinações ----
export function csvDestinacoes(rel: RelatorioDestinacoes): (string | number)[][] {
  const linhas: (string | number)[][] = [["Destinação", "Unidades", "Valor"]];
  rel.linhas.forEach((l) => linhas.push([l.nome, l.qtd, reais(l.valorCentavos)]));
  linhas.push(["Total", "", reais(rel.totalCentavos)]);
  return linhas;
}
export function txtDestinacoes(rel: RelatorioDestinacoes): string {
  const periodo = rel.inicio === rel.fim ? rel.inicio : `${rel.inicio} a ${rel.fim}`;
  const linhas = rel.linhas.map((l) => `${l.nome}: ${l.qtd} un · ${reais(l.valorCentavos)}`).join("\n");
  return `*Vendas por Destinação* — ${periodo}\n${linhas}\n*Total: ${reais(rel.totalCentavos)}*`;
}
