"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/ui/table";
import { StockBadge } from "@/components/StockBadge";
import { LivroForm } from "@/components/LivroForm";
import { listarLivros, excluirLivro, type Livro } from "@/lib/nuvem/livro";
import { listarSaldos } from "@/lib/nuvem/estoque";
import { reais } from "@/utils/texto";

const POR_PAGINA = 12;

// Cadastro (US2) — paridade com o PDV: lista com busca/ações/paginação; o
// formulário é uma TELA separada (novo/alterar), não inline.
export default function CadastroPage() {
  const [aberto, setAberto] = useState<Livro | "novo" | null>(null);
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [livros, setLivros] = useState<Livro[] | null>(null);
  const [saldos, setSaldos] = useState<Map<string, number>>(new Map());

  async function carregar() {
    const [ls, ss] = await Promise.all([listarLivros(), listarSaldos()]);
    setLivros(ls);
    setSaldos(ss);
  }
  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const base = livros ?? [];
    const q = termo.trim().toLowerCase();
    if (!q) return base;
    return base.filter((l) => `${l.titulo} ${l.autor ?? ""} ${l.codigo}`.toLowerCase().includes(q));
  }, [livros, termo]);

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
    // Cancelar também recarrega: um ajuste de estoque feito no formulário já está gravado (FR-007).
    const voltar = () => { setAberto(null); carregar(); };
    return <LivroForm inicial={aberto === "novo" ? null : aberto} onSalvo={voltar} onCancelar={voltar} />;
  }

  // ---- Tela de lista ----
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cadastro</h1>
        <Button onClick={() => setAberto("novo")} className="h-9">
          <Plus size={16} className="mr-1" /> Novo livro
        </Button>
      </div>

      <Input
        value={termo}
        onChange={(e) => {
          setTermo(e.currentTarget.value);
          setPagina(1);
        }}
        className="mt-4 h-9"
        placeholder="Buscar por título, autor ou código…"
        autoFocus
      />

      <div className="bg-card mt-4 rounded-xl border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[48%]">Livro</TableHead>
              <TableHead className="w-[18%] text-right">Preço</TableHead>
              <TableHead className="w-[18%] text-center">Estoque</TableHead>
              <TableHead className="w-[16%] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((l) => {
              const est = saldos.get(l.sync_uid) ?? 0;
              return (
                <TableRow key={l.sync_uid}>
                  <TableCell>
                    <div className="truncate font-medium">{l.titulo}</div>
                    <div className="text-muted-foreground truncate text-[11px]">
                      {l.autor ? `${l.autor} · ` : ""}
                      <span className="font-mono">{l.codigo}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono whitespace-nowrap">{reais(l.preco_centavos)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono">{est}</span>
                      <StockBadge estoque={est} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setAberto(l)} title="Editar">
                        <Pencil size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remover(l)} title="Remover" className="text-rose-500 hover:text-rose-600">
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
                  {termo.trim() ? "Nenhum livro encontrado." : "Nenhum livro cadastrado."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="text-muted-foreground mt-3 flex items-center justify-between text-sm">
          <span>
            {inicio + 1}–{Math.min(inicio + POR_PAGINA, total)} de {total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              <ChevronLeft size={15} />
            </Button>
            <span className="tabular-nums">{pagina} / {totalPaginas}</span>
            <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
