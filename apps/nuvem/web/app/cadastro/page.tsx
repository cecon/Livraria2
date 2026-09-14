"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { Textarea } from "@livraria/ui/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@livraria/ui/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/ui/table";
import { StockBadge } from "@/components/StockBadge";
import { CATEGORIAS } from "@/lib/catalogo";
import { listarLivros, salvarLivro, excluirLivro, type Livro } from "@/lib/nuvem/livro";
import { listarSaldos } from "@/lib/nuvem/estoque";
import { centavos, reais } from "@/utils/texto";

const POR_PAGINA = 12;
const centsInput = (c: number) => (c / 100).toFixed(2).replace(".", ",");

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
    return <LivroForm inicial={aberto === "novo" ? null : aberto} onSalvo={() => { setAberto(null); carregar(); }} onCancelar={() => setAberto(null)} />;
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

// Formulário de livro (tela separada) — paridade com o LivroForm do PDV.
function LivroForm({ inicial, onSalvo, onCancelar }: { inicial: Livro | null; onSalvo: () => void; onCancelar: () => void }) {
  const editando = inicial !== null;
  const [form, setForm] = useState(() => ({
    codigo: inicial?.codigo ?? "",
    titulo: inicial?.titulo ?? "",
    autor: inicial?.autor ?? "",
    valor: inicial ? centsInput(inicial.preco_centavos) : "",
    estoque: "0",
    categoria: inicial?.categoria ?? 0,
    descricao: inicial?.descricao ?? "",
  }));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!form.codigo.trim()) return toast.error("Informe o código (de barras) do livro");
    setSalvando(true);
    const { error } = await salvarLivro({
      sync_uid: inicial?.sync_uid,
      codigo: form.codigo,
      titulo: form.titulo,
      autor: form.autor,
      preco_centavos: centavos(form.valor),
      categoria: form.categoria,
      descricao: form.descricao,
      estoqueInicial: editando ? undefined : parseInt(form.estoque, 10) || 0,
    });
    setSalvando(false);
    if (error) return toast.error(error);
    toast.success(editando ? "Livro alterado" : "Livro cadastrado");
    onSalvo();
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{editando ? "Alterar livro" : "Novo livro"}</h1>

      <div className="bg-card mt-4 space-y-4 rounded-xl border p-5">
        <div>
          <Label htmlFor="cod">Código de barras (EAN/ISBN)</Label>
          <Input id="cod" value={form.codigo} disabled={editando} onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })} className="mt-1 h-9 font-mono" placeholder="ex.: 9788573671469" />
        </div>
        <div>
          <Label htmlFor="tit">Título</Label>
          <Input id="tit" value={form.titulo} autoFocus onChange={(e) => setForm({ ...form, titulo: e.currentTarget.value.toUpperCase() })} className="mt-1 h-9" />
        </div>
        <div>
          <Label htmlFor="aut">Autor</Label>
          <Input id="aut" value={form.autor ?? ""} onChange={(e) => setForm({ ...form, autor: e.currentTarget.value.toUpperCase() })} className="mt-1 h-9" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="val">Valor (R$)</Label>
            <Input id="val" value={form.valor} inputMode="decimal" placeholder="0,00" onChange={(e) => setForm({ ...form, valor: e.currentTarget.value })} className="mt-1 h-9 font-mono" />
          </div>
          <div>
            <Label htmlFor="est">{editando ? "Estoque atual" : "Estoque inicial"}</Label>
            <Input id="est" value={editando ? "—" : form.estoque} inputMode="numeric" disabled={editando} onChange={(e) => setForm({ ...form, estoque: e.currentTarget.value })} className="mt-1 h-9 font-mono" />
          </div>
        </div>
        <div>
          <Label>Categoria</Label>
          <Select value={String(form.categoria)} onValueChange={(v) => setForm({ ...form, categoria: Number(v) })}>
            <SelectTrigger className="mt-1 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.id} — {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="desc">Descrição</Label>
          <Textarea id="desc" value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} className="mt-1" />
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={salvar} disabled={salvando} className="h-9 bg-[#1f7a4d] text-white hover:bg-[#1a6a43]">
            {editando ? "Alterar" : "Cadastrar"}
          </Button>
          <Button variant="outline" onClick={onCancelar} className="ml-auto h-9">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
