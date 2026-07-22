"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/ui/table";
import { FornecedorSelect } from "@/components/FornecedorSelect";
import { EntradaProduto, type LivroBusca } from "@/components/EntradaProduto";
import { ItensNotaTabela } from "@/components/ItensNotaTabela";
import { listarFornecedores, type Fornecedor } from "@/lib/nuvem/fornecedor";
import { listarLivros } from "@/lib/nuvem/livro";
import { listarSaldos } from "@/lib/nuvem/estoque";
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

const dataBr = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

export default function LancamentosPage() {
  const [editorUid, setEditorUid] = useState<string | null>(null);
  const [itens, setItens] = useState<NotaResumo[] | null>(null);

  async function carregar() {
    setItens(await lancamentosListar());
  }
  useEffect(() => {
    if (editorUid === null) carregar();
  }, [editorUid]);

  async function novo() {
    setEditorUid(await lancamentoCriar());
  }

  if (editorUid !== null) {
    return <Editor uid={editorUid} onFechar={() => setEditorUid(null)} />;
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Lançamentos</h1>
        <Button onClick={novo} className="h-9">
          <Plus size={16} className="mr-1" /> Novo lançamento
        </Button>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">Notas de entrada por fornecedor. Salve como rascunho e dê entrada quando concluir.</p>

      <div className="bg-card mt-4 rounded-xl border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40%]">Fornecedor</TableHead>
              <TableHead className="w-[16%]">Data</TableHead>
              <TableHead className="w-[16%]">Status</TableHead>
              <TableHead className="w-[10%] text-right">Itens</TableHead>
              <TableHead className="w-[18%] text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(itens ?? []).map((l) => (
              <TableRow key={l.sync_uid} className="cursor-pointer" onClick={() => setEditorUid(l.sync_uid)}>
                <TableCell className="truncate">{l.fornecedorNome ?? "—"}</TableCell>
                <TableCell>{dataBr(l.data)}</TableCell>
                <TableCell>
                  <span className={`rounded px-2 py-0.5 text-[11px] ${l.status === "finalizada" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : l.status === "cancelada" ? "bg-muted text-muted-foreground line-through" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                    {l.status === "finalizada" ? "Finalizada" : l.status === "cancelada" ? "Cancelada" : "Rascunho"}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono">{l.qtdItens}</TableCell>
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
      </div>
    </div>
  );
}

function Editor({ uid, onFechar }: { uid: string; onFechar: () => void }) {
  const [nota, setNota] = useState<NotaDetalhe | null>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [livros, setLivros] = useState<LivroBusca[]>([]);
  const [busca, setBusca] = useState("");
  const [pendente, setPendente] = useState<LivroBusca | null>(null);
  const [qtd, setQtd] = useState("1");
  const [modoCusto, setModoCusto] = useState<"unit" | "total">("unit");
  const [custo, setCusto] = useState("");
  const codigoRef = useRef<HTMLInputElement>(null);
  const custoRef = useRef<HTMLInputElement>(null);

  async function recarregar() {
    setNota(await lancamentoObter(uid));
  }
  useEffect(() => {
    recarregar();
    (async () => {
      const [fs, ls, ss] = await Promise.all([listarFornecedores(), listarLivros(), listarSaldos()]);
      setFornecedores(fs);
      setLivros(ls.map((l) => ({ sync_uid: l.sync_uid, codigo: l.codigo, titulo: l.titulo, autor: l.autor, preco_centavos: l.preco_centavos, estoque: ss.get(l.sync_uid) ?? 0 })));
    })();
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
    if (!pendente) return;
    const q = parseInt(qtd, 10);
    if (!q || q <= 0) return toast.error("Quantidade inválida");
    const c = centavos(custo);
    if (c <= 0) return toast.error("Informe o custo (total ou unitário)");
    const custoUnit = modoCusto === "total" ? Math.round(c / q) : c;
    await lancamentoAdicionarItem(uid, pendente.sync_uid, q, custoUnit);
    setPendente(null);
    setCusto("");
    setQtd("1");
    codigoRef.current?.focus();
    recarregar();
  }

  async function escolherFornecedor(f: Fornecedor) {
    await lancamentoDefinirFornecedor(uid, f.sync_uid, nota?.numero ?? undefined);
    setNota((n) => (n ? { ...n, fornecedorUid: f.sync_uid, fornecedorNome: f.nome } : n));
  }

  async function remover(itemUid: string) {
    await lancamentoRemoverItem(itemUid);
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

  if (!nota) return null;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {nota.status === "rascunho" ? "Lançamento (rascunho)" : nota.status === "cancelada" ? "Nota (cancelada)" : "Nota (finalizada)"}
        </h1>
        <Button variant="ghost" onClick={onFechar}>← Voltar</Button>
      </div>

      <div className="bg-card mt-4 grid grid-cols-2 gap-4 rounded-xl border p-5">
        <div>
          <Label>Fornecedor</Label>
          {lendo ? (
            <div className="mt-1 h-9 leading-9">{nota.fornecedorNome ?? "—"}</div>
          ) : (
            <FornecedorSelect fornecedores={fornecedores} selecionadoNome={nota.fornecedorNome} onSelect={escolherFornecedor} />
          )}
        </div>
        <div>
          <Label>Número da nota (opcional)</Label>
          <Input
            value={nota.numero ?? ""}
            disabled={lendo}
            onChange={(e) => setNota({ ...nota, numero: e.currentTarget.value })}
            onBlur={() => nota.fornecedorUid && lancamentoDefinirFornecedor(uid, nota.fornecedorUid, nota.numero ?? undefined)}
            className="mt-1 h-9"
          />
        </div>
      </div>

      {!lendo && (
        <div className="bg-card mt-4 rounded-xl border p-5">
          <Label>Adicionar item</Label>
          <div className="mt-1">
            <EntradaProduto value={busca} onChange={setBusca} inputRef={codigoRef} livros={livros} onCodigoExato={resolverCodigo} onSelecionar={escolherLivro} />
          </div>
          {pendente && (
            <div className="mt-3 flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-muted-foreground text-[11px]">Livro</span>
                <div className="truncate font-medium">{pendente.titulo}</div>
              </div>
              <div className="w-16">
                <span className="text-muted-foreground text-[11px]">Qtd</span>
                <Input value={qtd} onChange={(e) => setQtd(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && custoRef.current?.focus()} inputMode="numeric" className="h-9 text-center font-mono" />
              </div>
              <select value={modoCusto} onChange={(e) => setModoCusto(e.currentTarget.value as "unit" | "total")} className="border-input bg-background h-9 rounded-md border px-2 text-sm">
                <option value="unit">Unit.</option>
                <option value="total">Total</option>
              </select>
              <div className="w-28">
                <span className="text-muted-foreground text-[11px]">Custo (R$)</span>
                <Input ref={custoRef} value={custo} onChange={(e) => setCusto(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} inputMode="decimal" placeholder="0,00" className="h-9 text-right font-mono" />
              </div>
              <Button onClick={adicionar} className="h-9">Adicionar</Button>
            </div>
          )}
        </div>
      )}

      <ItensNotaTabela itens={nota.itens} lendo={lendo} onRemover={remover} />

      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-lg font-bold">Total: {reais(nota.totalCentavos)}</span>
        {nota.status === "rascunho" && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={excluir} className="text-rose-500 hover:text-rose-600">Excluir rascunho</Button>
            <Button onClick={darEntrada} className="bg-[#1f7a4d] text-white hover:bg-[#1a6a43]">Dar entrada</Button>
          </div>
        )}
        {nota.status === "finalizada" && (
          <Button variant="outline" onClick={cancelar} className="text-rose-600 hover:text-rose-700">Cancelar lançamento (estornar)</Button>
        )}
      </div>
    </div>
  );
}
