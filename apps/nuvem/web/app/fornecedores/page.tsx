"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { Textarea } from "@livraria/ui/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/ui/table";
import { listarFornecedores, salvarFornecedor, inativarFornecedor, type Fornecedor } from "@/lib/nuvem/fornecedor";
import { PageHeader } from "@/components/PageHeader";
import { ContentPanel } from "@/components/ContentPanel";

const POR_PAGINA = 12;

// Fornecedores (US2) — paridade com o PDV: lista com busca/ações/paginação;
// formulário em TELA separada.
export default function FornecedoresPage() {
  const [aberto, setAberto] = useState<Fornecedor | "novo" | null>(null);
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<Fornecedor[] | null>(null);

  async function carregar() {
    try { setLista(await listarFornecedores()); }
    catch (error) {
      setLista([]);
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar os fornecedores.");
    }
  }
  useEffect(() => {
    void carregar();
  }, []);

  const filtrados = useMemo(() => {
    const base = lista ?? [];
    const q = termo.trim().toLowerCase();
    if (!q) return base;
    return base.filter((f) => `${f.nome} ${f.documento ?? ""}`.toLowerCase().includes(q));
  }, [lista, termo]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const inicio = (pagina - 1) * POR_PAGINA;
  const visiveis = filtrados.slice(inicio, inicio + POR_PAGINA);

  async function remover(f: Fornecedor) {
    if (!window.confirm(`Inativar "${f.nome}"?`)) return;
    const { error } = await inativarFornecedor(f.sync_uid);
    if (error) return toast.error(error);
    toast.success("Fornecedor inativado");
    carregar();
  }

  if (aberto !== null) {
    return <FornecedorForm inicial={aberto === "novo" ? null : aberto} onSalvo={() => { setAberto(null); carregar(); }} onCancelar={() => setAberto(null)} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:p-6 lg:py-7">
      <PageHeader
        title="Fornecedores"
        description="Empresas e pessoas vinculadas aos lançamentos de entrada."
        crumbs={[{ label: "Catálogo" }, { label: "Fornecedores" }]}
        action={<Button onClick={() => setAberto("novo")} className="h-10">
          <Plus size={16} className="mr-1" /> Novo fornecedor
        </Button>}
      />

      <ContentPanel
        title="Fornecedores cadastrados"
        description={lista === null ? "Carregando fornecedores..." : `${filtrados.length} fornecedor(es) encontrado(s)`}
        toolbar={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              aria-label="Buscar fornecedores"
              value={termo}
              onChange={(e) => {
                setTermo(e.currentTarget.value);
                setPagina(1);
              }}
              className="h-10 w-full pl-9 sm:w-72"
              placeholder="Nome ou documento"
              autoFocus
            />
          </div>
        }
        flush
        footer={filtrados.length > POR_PAGINA ? (
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <Button aria-label="Página anterior" title="Página anterior" variant="outline" size="icon-sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}><ChevronLeft /></Button>
            <span className="tabular-nums">{pagina} / {totalPaginas}</span>
            <Button aria-label="Próxima página" title="Próxima página" variant="outline" size="icon-sm" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}><ChevronRight /></Button>
          </div>
        ) : undefined}
      >
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fornecedor</TableHead>
              <TableHead className="hidden w-[28%] sm:table-cell">Telefone</TableHead>
              <TableHead className="w-[84px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map((f) => (
              <TableRow key={f.sync_uid}>
                <TableCell>
                  <div className="truncate font-medium">{f.nome}</div>
                  {f.documento && <div className="text-muted-foreground truncate text-[11px] font-mono">{f.documento}</div>}
                  <div className="truncate text-[11px] text-muted-foreground sm:hidden">{f.telefone ?? "Sem telefone"}</div>
                </TableCell>
                <TableCell className="hidden truncate sm:table-cell">{f.telefone ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setAberto(f)} title="Editar" aria-label={`Editar ${f.nome}`}>
                      <Pencil size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remover(f)} title="Inativar" aria-label={`Inativar ${f.nome}`} className="text-rose-500 hover:text-rose-600">
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {lista !== null && visiveis.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="text-muted-foreground py-10 text-center">
                  {termo.trim() ? "Nenhum fornecedor encontrado." : "Nenhum fornecedor cadastrado."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ContentPanel>
    </div>
  );
}

function FornecedorForm({ inicial, onSalvo, onCancelar }: { inicial: Fornecedor | null; onSalvo: () => void; onCancelar: () => void }) {
  const editando = inicial !== null;
  const [form, setForm] = useState(() => ({
    nome: inicial?.nome ?? "",
    documento: inicial?.documento ?? "",
    telefone: inicial?.telefone ?? "",
    email: inicial?.email ?? "",
    observacoes: inicial?.observacoes ?? "",
  }));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!form.nome.trim()) return toast.error("Informe o nome do fornecedor");
    setSalvando(true);
    const { error } = await salvarFornecedor({
      sync_uid: inicial?.sync_uid,
      nome: form.nome,
      documento: form.documento || null,
      telefone: form.telefone || null,
      email: form.email || null,
      observacoes: form.observacoes || null,
      ativo: inicial?.ativo ?? true,
    });
    setSalvando(false);
    if (error) return toast.error(error);
    toast.success(editando ? "Fornecedor alterado" : "Fornecedor cadastrado");
    onSalvo();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-5 sm:p-6 lg:py-7">
      <PageHeader
        title={editando ? "Alterar fornecedor" : "Novo fornecedor"}
        description="Dados de identificação e contato usados nos lançamentos."
        crumbs={[{ label: "Fornecedores", onClick: onCancelar }, { label: editando ? "Alterar" : "Novo" }]}
        back={{ label: "Voltar para fornecedores", onClick: onCancelar }}
      />
      <ContentPanel title="Dados do fornecedor">
        <div className="admin-form space-y-4">
        <div>
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" value={form.nome} autoFocus onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })} className="mt-1 h-9" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="doc">Documento (CNPJ/CPF)</Label>
            <Input id="doc" value={form.documento ?? ""} onChange={(e) => setForm({ ...form, documento: e.currentTarget.value })} className="mt-1 h-9 font-mono" placeholder="opcional" />
          </div>
          <div>
            <Label htmlFor="tel">Telefone</Label>
            <Input id="tel" value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.currentTarget.value })} className="mt-1 h-9" placeholder="opcional" />
          </div>
        </div>
        <div>
          <Label htmlFor="mail">E-mail</Label>
          <Input id="mail" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} className="mt-1 h-9" placeholder="opcional" />
        </div>
        <div>
          <Label htmlFor="obs">Observações</Label>
          <Textarea id="obs" value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.currentTarget.value })} className="mt-1" />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={salvar} disabled={salvando} className="h-10">
            {editando ? "Alterar" : "Cadastrar"}
          </Button>
          <Button variant="outline" onClick={onCancelar} className="h-10 sm:ml-auto">Cancelar</Button>
        </div>
        </div>
      </ContentPanel>
    </div>
  );
}
