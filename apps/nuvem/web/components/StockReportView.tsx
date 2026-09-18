"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/wowdash/table";
import { Button } from "@livraria/ui/wowdash/button";
import { CATEGORIAS } from "@/lib/catalogo";
import { reais } from "@/utils/texto";
import type { RelatorioEstoque } from "@/lib/nuvem/relatorios";

type Item = RelatorioEstoque["itens"][number];
type SortKey = "codigo" | "titulo" | "categoria" | "precoCentavos" | "estoque" | "valorCentavos";
type Direction = "asc" | "desc";
const PAGE_SIZE = 25;

const category = (id: number) => CATEGORIAS.find((item) => item.id === id)?.nome ?? String(id);
const columns: { key: SortKey; label: string; numeric?: boolean; hidden?: string }[] = [
  { key: "codigo", label: "Código", hidden: "hidden md:table-cell" },
  { key: "titulo", label: "Produto" },
  { key: "categoria", label: "Categoria", hidden: "hidden lg:table-cell" },
  { key: "precoCentavos", label: "Preço", numeric: true, hidden: "hidden sm:table-cell" },
  { key: "estoque", label: "Estoque", numeric: true },
  { key: "valorCentavos", label: "Valor", numeric: true },
];

function compareItems(a: Item, b: Item, key: SortKey) {
  if (key === "codigo" || key === "titulo") return a[key].localeCompare(b[key], "pt-BR", { numeric: true });
  return a[key] - b[key];
}

export function StockReportView({ report }: { report: RelatorioEstoque }) {
  const [key, setKey] = useState<SortKey>("titulo");
  const [direction, setDirection] = useState<Direction>("asc");
  const [page, setPage] = useState(1);
  const items = useMemo(() => [...report.itens].sort((a, b) => {
    const result = compareItems(a, b, key) || a.codigo.localeCompare(b.codigo, "pt-BR");
    return direction === "asc" ? result : -result;
  }), [report.itens, key, direction]);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * PAGE_SIZE;

  function sortBy(next: SortKey) {
    setDirection(key === next && direction === "asc" ? "desc" : "asc");
    setKey(next);
    setPage(1);
  }

  return (
    <section className="space-y-3" aria-label="Relatório de estoque">
      <div>
        <h2 className="text-lg font-semibold">Relatório de Estoque</h2>
        <p className="text-muted-foreground text-sm">
          {report.titulos} títulos · Valor em estoque: {reais(report.valorTotalCentavos)}
        </p>
      </div>
      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((column) => (
                <TableHead key={column.key} aria-sort={key === column.key ?
                  direction === "asc" ? "ascending" : "descending" : "none"}
                  className={`${column.numeric ? "text-right" : ""} ${column.hidden ?? ""}`}>
                  <button type="button" onClick={() => sortBy(column.key)}
                    aria-label={`Ordenar por ${column.label}`}
                    className={`inline-flex min-h-10 items-center gap-1.5 font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${column.numeric ? "justify-end" : ""}`}>
                    {column.label}
                    {key !== column.key ? <ArrowUpDown size={14} aria-hidden="true" /> :
                      direction === "asc" ? <ArrowUp size={14} aria-hidden="true" /> :
                        <ArrowDown size={14} aria-hidden="true" />}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.slice(start, start + PAGE_SIZE).map((item) => (
              <TableRow key={item.codigo}>
                <TableCell className="hidden font-mono text-xs md:table-cell">{item.codigo}</TableCell>
                <TableCell className="min-w-0 whitespace-normal break-words font-medium" title={item.titulo}>
                  <span className="line-clamp-2">{item.titulo}</span>
                  <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground sm:hidden">
                    {item.codigo} · {category(item.categoria)} · {reais(item.precoCentavos)}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">{category(item.categoria)}</TableCell>
                <TableCell className="hidden text-right font-mono sm:table-cell">{reais(item.precoCentavos)}</TableCell>
                <TableCell className="text-right font-mono">{item.estoque}</TableCell>
                <TableCell className="text-right font-mono">{reais(item.valorCentavos)}</TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
              Nenhum produto ativo em estoque.
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {items.length > PAGE_SIZE && <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{start + 1}–{Math.min(start + PAGE_SIZE, items.length)} de {items.length}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" title="Página anterior" aria-label="Página anterior"
            disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="tabular-nums">{currentPage} / {pages}</span>
          <Button type="button" variant="ghost" size="icon" title="Próxima página" aria-label="Próxima página"
            disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>}
    </section>
  );
}
