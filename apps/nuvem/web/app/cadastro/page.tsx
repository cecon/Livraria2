"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { PageHeader } from "@/components/PageHeader";
import { ContentPanel } from "@/components/ContentPanel";

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
    try {
      const [ls, ss] = await Promise.all([listarLivros(), listarSaldos()]);
      setLivros(ls);
      setSaldos(ss);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Catalogo indisponivel");
    }
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
        title="Livros cadastrados"
        description={livros === null ? "Carregando catálogo..." : `${total} livro(s) encontrado(s)`}
        toolbar={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              aria-label="Buscar livros"
              value={termo}
              onChange={(e) => {
                setTermo(e.currentTarget.value);
                setPagina(1);
              }}
              className="h-10 w-full pl-9 sm:w-80"
              placeholder="Título, autor ou código"
              autoFocus
            />
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
                    <div className="truncate font-medium">{l.titulo}</div>
                    <div className="text-muted-foreground truncate text-[11px]">
                      {l.autor ? `${l.autor} · ` : ""}
                      <span className="font-mono">{l.codigo}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 md:hidden">
                      <span className="text-[11px] text-muted-foreground">Estoque</span>
                      <StockBadge estoque={est} />
                    </div>
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
                      <Button variant="ghost" size="icon" onClick={() => setAberto(l)} title="Editar" aria-label={`Editar ${l.titulo}`}>
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
                  {termo.trim() ? "Nenhum livro encontrado." : "Nenhum livro cadastrado."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ContentPanel>
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
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-5 sm:p-6 lg:py-7">
      <PageHeader
        title={editando ? "Alterar livro" : "Novo livro"}
        description={editando ? "Atualize os dados comerciais e bibliográficos." : "Inclua um novo título no catálogo da livraria."}
        crumbs={[{ label: "Livros", onClick: onCancelar }, { label: editando ? "Alterar" : "Novo" }]}
        back={{ label: "Voltar para livros", onClick: onCancelar }}
      />

      <ContentPanel title="Dados do livro" description="Campos usados na pesquisa, venda e sincronização com os caixas.">
        <div className="admin-form space-y-4">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <Label htmlFor="categoria">Categoria</Label>
          <Select value={String(form.categoria)} onValueChange={(v) => setForm({ ...form, categoria: Number(v) })}>
            <SelectTrigger id="categoria" className="mt-1 h-10">
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

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={salvar} disabled={salvando} className="h-10">
            {editando ? "Alterar" : "Cadastrar"}
          </Button>
          <Button variant="outline" onClick={onCancelar} className="h-10 sm:ml-auto">
            Cancelar
          </Button>
        </div>
        </div>
      </ContentPanel>
    </div>
  );
}
