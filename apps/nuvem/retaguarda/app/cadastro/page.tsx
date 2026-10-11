"use client";

import { Cover } from "@/components/Cover";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/interface/ui/button";
import { Input } from "@/interface/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/interface/ui/table";
import { StockBadge } from "@/components/StockBadge";
import { listarLivros, excluirLivro, type Livro } from "@/lib/nuvem/livro";
import { listarSaldos } from "@/lib/nuvem/estoque";
import { BrowserApiError } from "@/lib/api/browser-client";
import { reais } from "@/utils/texto";
import { PageHeader } from "@/components/PageHeader";
import { ContentPanel } from "@/components/ContentPanel";
import { LivroForm } from "./LivroForm";

const POR_PAGINA = 12;

// Cadastro (US2) — paridade com o PDV: lista com busca/ações/paginação; o
// formulário é uma TELA separada (novo/alterar), não inline.
export default function CadastroPage() {
  const [aberto, setAberto] = useState<Livro | "novo" | null>(null);
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [livros, setLivros] = useState<Livro[] | null>(null);
  const [saldos, setSaldos] = useState<Map<string, number>>(new Map());

  async function carregar() {
    try {
      const [ls, ss] = await Promise.all([listarLivros(true), listarSaldos()]);
      setLivros(ls);
      setSaldos(ss);
    } catch (error) {
      if (error instanceof BrowserApiError && error.status === 401) return;
      toast.error(error instanceof Error ? error.message : "Catalogo indisponivel");
    }
  }
  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const base = (livros ?? []).filter((livro) => livro.ativo === !mostrarInativos);
    const q = termo.trim().toLowerCase();
    if (!q) return base;
    return base.filter((l) => `${l.titulo} ${l.autor ?? ""} ${l.codigo}`.toLowerCase().includes(q));
  }, [livros, termo, mostrarInativos]);

  const total = filtrados.length;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const inicio = (pagina - 1) * POR_PAGINA;
  const itens = filtrados.slice(inicio, inicio + POR_PAGINA);

  async function remover(l: Livro) {
    if (!window.confirm(`Excluir "${l.titulo}"?`)) return;
    const { error } = await excluirLivro(l.sync_uid);
    if (error) return toast.error(error);
    toast.success("Livro excluído");
    carregar();
  }

  // ---- Tela de formulário (substitui a lista) ----
  if (aberto !== null) {
    return <LivroForm inicial={aberto === "novo" ? null : aberto}
      saldo={aberto === "novo" ? null : saldos.get(aberto.sync_uid) ?? 0}
      onSalvo={() => { setAberto(null); carregar(); }} onCancelar={() => { setAberto(null); carregar(); }} />;
  }

  // ---- Tela de lista ----
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:p-6 lg:py-7">
      <PageHeader
        title="Livros"
        description="Consulte e mantenha o catálogo disponível para os caixas."
        crumbs={[{ label: "Catálogo" }, { label: "Livros" }]}
        action={<Button onClick={() => setAberto("novo")} className="h-10">
          <Plus size={16} className="mr-1" /> Novo livro
        </Button>}
      />

      <ContentPanel
        title={mostrarInativos ? "Livros inativos" : "Livros cadastrados"}
        description={livros === null ? "Carregando catálogo..." : `${total} livro(s) encontrado(s)`}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border p-1" role="group" aria-label="Situação dos livros">
              <Button type="button" size="sm" variant={mostrarInativos ? "ghost" : "secondary"}
                onClick={() => { setMostrarInativos(false); setPagina(1); }}>Ativos</Button>
              <Button type="button" size="sm" variant={mostrarInativos ? "secondary" : "ghost"}
                onClick={() => { setMostrarInativos(true); setPagina(1); }}>Inativos</Button>
            </div>
            <div className="relative">

            <Input
              aria-label="Buscar livros"
              value={termo}
              onChange={(e) => {
                setTermo(e.currentTarget.value);
                setPagina(1);
              }}
              startIcon={<Search size={16} />} className="h-10 w-full sm:w-80"
              placeholder="Título, autor ou código"
              autoFocus
            />
            </div>
          </div>
        }
        flush
        footer={total > 0 ? (
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{inicio + 1}–{Math.min(inicio + POR_PAGINA, total)} de {total}</span>
            <div className="flex items-center gap-2">
              <Button aria-label="Página anterior" title="Página anterior" variant="outline" size="icon-sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                <ChevronLeft size={15} />
              </Button>
              <span className="tabular-nums">{pagina} / {totalPaginas}</span>
              <Button aria-label="Próxima página" title="Próxima página" variant="outline" size="icon-sm" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        ) : undefined}
      >
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Livro</TableHead>
              <TableHead className="w-20 text-right sm:w-28">Preço</TableHead>
              <TableHead className="hidden w-[18%] text-center md:table-cell">Estoque</TableHead>
              <TableHead className="w-[84px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((l) => {
              const est = saldos.get(l.sync_uid) ?? 0;
              return (
                <TableRow key={l.sync_uid}>
                  <TableCell>
                    <div className="flex items-center gap-3"><Cover titulo={l.titulo} capaUid={l.capaUid} tamanho="sm" /><div className="min-w-0"><div className="truncate font-medium">{l.titulo}</div>
                    <div className="text-muted-foreground truncate text-[11px]">
                      {l.autor ? `${l.autor} · ` : ""}
                      <span className="font-mono">{l.codigo}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 md:hidden">
                      <span className="text-[11px] text-muted-foreground">Estoque</span>
                      <StockBadge estoque={est} />
                    </div></div></div>
                  </TableCell>
                  <TableCell className="text-right font-mono whitespace-nowrap">{reais(l.preco_centavos)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono">{est}</span>
                      <StockBadge estoque={est} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setAberto(l)} title={l.ativo ? "Editar" : "Editar ou reativar"} aria-label={`${l.ativo ? "Editar" : "Editar ou reativar"} ${l.titulo}`}>
                        <Pencil size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remover(l)} title="Remover" aria-label={`Remover ${l.titulo}`} className="text-rose-500 hover:text-rose-600">
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {livros !== null && itens.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                  {termo.trim() ? "Nenhum livro encontrado." : mostrarInativos ? "Nenhum livro inativo." : "Nenhum livro ativo."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ContentPanel>
    </div>
  );
}
