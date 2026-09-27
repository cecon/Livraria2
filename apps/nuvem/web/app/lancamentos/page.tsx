"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/ui/table";
import { FornecedorSelect } from "@/components/FornecedorSelect";
import { Cover } from "@/components/Cover";
import { EntradaProduto, type LivroBusca } from "@/components/EntradaProduto";
import { ItensNotaTabela } from "@/components/ItensNotaTabela";
import { listarFornecedores, type Fornecedor } from "@/lib/nuvem/fornecedor";
import { listarLivros } from "@/lib/nuvem/livro";
import { listarSaldos } from "@/lib/nuvem/estoque";
import { BrowserApiError } from "@/lib/api/browser-client";
import {
  lancamentosListar,
  lancamentoCriar,
  lancamentoObter,
  lancamentoDefinirFornecedor,
  lancamentoAdicionarItem,
  lancamentoRemoverItem,
  lancamentoFinalizar,
  lancamentoCancelar,
  lancamentoExcluir,
  type NotaResumo,
  type NotaDetalhe,
} from "@/lib/nuvem/lancamento";
import { centavos, reais } from "@/utils/texto";
import { PageHeader } from "@/components/PageHeader";
import { ContentPanel } from "@/components/ContentPanel";

const dataBr = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

export default function LancamentosPage() {
  const [editorUid, setEditorUid] = useState<string | null>(null);
  const [itens, setItens] = useState<NotaResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setErro(null);
    try { setItens(await lancamentosListar()); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível carregar os lançamentos."); }
  }
  useEffect(() => {
    if (editorUid === null) carregar();
  }, [editorUid]);

  async function novo() {
    try { setEditorUid(await lancamentoCriar()); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar o lançamento."); }
  }

  if (editorUid !== null) {
    return <Editor uid={editorUid} onFechar={() => setEditorUid(null)} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:p-6 lg:py-7">
      <PageHeader
        title="Lançamentos"
        description="Notas de entrada por fornecedor, do rascunho à atualização do estoque."
        crumbs={[{ label: "Catálogo" }, { label: "Lançamentos" }]}
        action={<Button onClick={novo} className="h-10">
          <Plus size={16} className="mr-1" /> Novo lançamento
        </Button>}
      />

      <ContentPanel
        title="Notas de entrada"
        description={erro ? "Falha ao carregar lançamentos." : itens === null ? "Carregando lançamentos..." : `${itens.length} lançamento(s)`}
        flush
      >
        {erro && <div role="alert" className="space-y-3 p-5"><p>{erro}</p><Button variant="outline" onClick={() => void carregar()}>Tentar novamente</Button></div>}
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fornecedor</TableHead>
              <TableHead className="hidden w-[16%] sm:table-cell">Data</TableHead>
              <TableHead className="w-[84px]">Status</TableHead>
              <TableHead className="hidden w-[10%] text-right lg:table-cell">Itens</TableHead>
              <TableHead className="w-[88px] text-right sm:w-[18%]">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(itens ?? []).map((l) => (
              <TableRow key={l.sync_uid} className="cursor-pointer" onClick={() => setEditorUid(l.sync_uid)}>
                <TableCell>
                  <div className="truncate">{l.fornecedorNome ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground sm:hidden">{dataBr(l.data)} · {l.qtdItens} item(ns)</div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{dataBr(l.data)}</TableCell>
                <TableCell>
                  <span className={`rounded px-2 py-0.5 text-[11px] ${l.status === "finalizada" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : l.status === "cancelada" ? "bg-muted text-muted-foreground line-through" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                    {l.status === "finalizada" ? "Finalizada" : l.status === "cancelada" ? "Cancelada" : "Rascunho"}
                  </span>
                </TableCell>
                <TableCell className="hidden text-right font-mono lg:table-cell">{l.qtdItens}</TableCell>
                <TableCell className="text-right font-mono">{reais(l.totalCentavos)}</TableCell>
              </TableRow>
            ))}
            {itens !== null && itens.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">Nenhum lançamento ainda. Clique em “Novo lançamento”.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ContentPanel>
    </div>
  );
}

function Editor({ uid, onFechar }: { uid: string; onFechar: () => void }) {
  const [nota, setNota] = useState<NotaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [livros, setLivros] = useState<LivroBusca[]>([]);
  const [busca, setBusca] = useState("");
  const [pendente, setPendente] = useState<LivroBusca | null>(null);
  const [qtd, setQtd] = useState("1");
  const [modoCusto, setModoCusto] = useState<"unit" | "total">("unit");
  const [custo, setCusto] = useState("");
  const adicionando = useRef(false);
  const codigoRef = useRef<HTMLInputElement>(null);
  const custoRef = useRef<HTMLInputElement>(null);

  async function recarregar() {
    setErro(null);
    try {
      const detalhe = await lancamentoObter(uid);
      if (!detalhe) throw new Error("Lançamento não encontrado.");
      setNota(detalhe);
    }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível carregar o lançamento."); }
  }
  useEffect(() => {
    recarregar();
    (async () => {
      const [fs, ls, ss] = await Promise.all([listarFornecedores(), listarLivros(true), listarSaldos()]);
      setFornecedores(fs);
      setLivros(ls.map((l) => ({ capaUid: l.capaUid, sync_uid: l.sync_uid, codigo: l.codigo, titulo: l.titulo, autor: l.autor, preco_centavos: l.preco_centavos, estoque: ss.get(l.sync_uid) ?? 0, ativo: l.ativo })));
    })().catch((error) => {
      if (error instanceof BrowserApiError && error.status === 401) return;
      toast.error("Catalogo indisponivel. Confira sua sessao.");
    });
  }, [uid]);

  const mapaCodigo = useMemo(() => new Map(livros.map((l) => [l.codigo, l])), [livros]);
  const lendo = nota !== null && nota.status !== "rascunho";

  function escolherLivro(l: LivroBusca) {
    setPendente(l);
    setBusca("");
    setTimeout(() => custoRef.current?.focus(), 0);
  }

  function resolverCodigo() {
    const l = mapaCodigo.get(busca.trim());
    if (l) escolherLivro(l);
    else toast.error(`"${busca.trim()}" não encontrado no acervo`);
  }

  async function adicionar() {
    if (!pendente || adicionando.current) return;
    const q = parseInt(qtd, 10);
    if (!q || q <= 0) return toast.error("Quantidade inválida");
    const c = centavos(custo);
    if (c <= 0) return toast.error("Informe o custo (total ou unitário)");
    const custoUnit = modoCusto === "total" ? Math.round(c / q) : c;
    const reativar = pendente.ativo === false;
    if (reativar && !window.confirm(`O título “${pendente.titulo}” está inativo. Ativar título e adicionar ao lançamento? Ele voltará ao catálogo ativo.`)) return;
    adicionando.current = true;
    try {
      await lancamentoAdicionarItem(uid, pendente.sync_uid, q, custoUnit, reativar);
      if (reativar) setLivros((lista) => lista.map((l) => l.sync_uid === pendente.sync_uid ? { ...l, ativo: true } : l));
      setPendente(null);
      setCusto("");
      setQtd("1");
      codigoRef.current?.focus();
      await recarregar();
    } catch (error) {
      if (error instanceof Error && error.message === "Título inativo. Confirme a ativação ao adicionar novamente.") {
        setPendente((l) => l ? { ...l, ativo: false } : l);
      }
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar o título.");
    } finally { adicionando.current = false; }
  }

  async function escolherFornecedor(f: Fornecedor) {
    await lancamentoDefinirFornecedor(uid, f.sync_uid, nota?.numero ?? undefined);
    setNota((n) => (n ? { ...n, fornecedorUid: f.sync_uid, fornecedorNome: f.nome } : n));
  }

  async function remover(itemUid: string) {
    await lancamentoRemoverItem(itemUid, uid);
    recarregar();
  }

  async function darEntrada() {
    const { error } = await lancamentoFinalizar(uid);
    if (error) return toast.error(error);
    toast.success("Entrada registrada — estoque atualizado");
    onFechar();
  }

  async function excluir() {
    if (!window.confirm("Excluir este rascunho? Nada será lançado no estoque.")) return;
    await lancamentoExcluir(uid);
    toast.info("Rascunho excluído");
    onFechar();
  }

  async function cancelar() {
    if (!window.confirm("Cancelar este lançamento? O estoque dos itens será ESTORNADO (revertido).")) return;
    const { error } = await lancamentoCancelar(uid);
    if (error) return toast.error(error);
    toast.success("Lançamento cancelado — estoque estornado");
    onFechar();
  }

  if (!nota || erro) return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:p-6 lg:py-7">
      <PageHeader title="Lançamento" crumbs={[{ label: "Lançamentos", onClick: onFechar }]} back={{ label: "Voltar para lançamentos", onClick: onFechar }} />
      <ContentPanel title="Dados da nota">
        {erro ? <div role="alert" className="space-y-3"><p>{erro}</p><Button variant="outline" onClick={() => void recarregar()}>Tentar novamente</Button></div>
          : <p role="status">Carregando lançamento...</p>}
      </ContentPanel>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:p-6 lg:py-7">
      <PageHeader
        title={nota.status === "rascunho" ? "Lançamento em rascunho" : nota.status === "cancelada" ? "Nota cancelada" : "Nota finalizada"}
        description="Confira fornecedor, identificação da nota e itens recebidos."
        crumbs={[{ label: "Lançamentos", onClick: onFechar }, { label: nota.status === "rascunho" ? "Rascunho" : "Detalhes" }]}
        back={{ label: "Voltar para lançamentos", onClick: onFechar }}
      />

      <ContentPanel title="Dados da nota">
        <div className="admin-form grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Fornecedor</Label>
          {lendo ? (
            <div className="mt-1 h-9 leading-9">{nota.fornecedorNome ?? "—"}</div>
          ) : (
            <FornecedorSelect fornecedores={fornecedores} selecionadoNome={nota.fornecedorNome} onSelect={escolherFornecedor} />
          )}
        </div>
        <div>
          <Label htmlFor="numero-nota">Número da nota (opcional)</Label>
          <Input
            id="numero-nota"
            value={nota.numero ?? ""}
            disabled={lendo}
            onChange={(e) => setNota({ ...nota, numero: e.currentTarget.value })}
            onBlur={() => nota.fornecedorUid && lancamentoDefinirFornecedor(uid, nota.fornecedorUid, nota.numero ?? undefined)}
            className="mt-1 h-9"
          />
        </div>
        </div>
      </ContentPanel>

      {!lendo && (
        <ContentPanel title="Adicionar item" description="Leia o código ou pesquise um livro do catálogo.">
          <div className="admin-form">
          <div className="mt-1">
            <EntradaProduto value={busca} onChange={setBusca} inputRef={codigoRef} livros={livros} onCodigoExato={resolverCodigo} onSelecionar={escolherLivro} />
          </div>
          {pendente && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <span className="text-muted-foreground text-[11px]">Livro</span>
                <div className="flex items-center gap-3"><Cover titulo={pendente.titulo} capaUid={pendente.capaUid} tamanho="sm" /><span className="truncate font-medium">{pendente.titulo}</span></div>
              </div>
              <div className="w-full sm:w-16">
                <span className="text-muted-foreground text-[11px]">Qtd</span>
                <Input value={qtd} onChange={(e) => setQtd(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && custoRef.current?.focus()} inputMode="numeric" className="h-9 text-center font-mono" />
              </div>
              <select aria-label="Tipo do custo" value={modoCusto} onChange={(e) => setModoCusto(e.currentTarget.value as "unit" | "total")} className="border-input bg-background h-10 rounded-md border px-2 text-sm">
                <option value="unit">Unit.</option>
                <option value="total">Total</option>
              </select>
              <div className="w-full sm:w-28">
                <span className="text-muted-foreground text-[11px]">Custo (R$)</span>
                <Input ref={custoRef} value={custo} onChange={(e) => setCusto(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} inputMode="decimal" placeholder="0,00" className="h-9 text-right font-mono" />
              </div>
              <Button onClick={adicionar} className="h-9">Adicionar</Button>
            </div>
          )}
          </div>
        </ContentPanel>
      )}

      <ItensNotaTabela itens={nota.itens} lendo={lendo} onRemover={remover} />

      <div className="admin-panel flex flex-wrap items-center justify-between gap-3 border bg-card p-4">
        <span className="font-mono text-lg font-bold">Total: {reais(nota.totalCentavos)}</span>
        {nota.status === "rascunho" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={excluir} className="text-rose-500 hover:text-rose-600">Excluir rascunho</Button>
            <Button onClick={darEntrada}>Dar entrada</Button>
          </div>
        )}
        {nota.status === "finalizada" && (
          <Button variant="outline" onClick={cancelar} className="text-rose-600 hover:text-rose-700">Cancelar lançamento (estornar)</Button>
        )}
      </div>
    </div>
  );
}
