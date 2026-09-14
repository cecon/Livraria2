"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { StockBadge } from "@/components/StockBadge";
import { Cover } from "@/components/Cover";
import { AjusteEstoque } from "@/components/AjusteEstoque";
import { ExtratoMovimentos } from "@/components/ExtratoMovimentos";
import { CATEGORIAS } from "@/lib/catalogo";
import { listarLivros, type Livro } from "@/lib/nuvem/livro";
import { listarSaldos } from "@/lib/nuvem/estoque";
import { reais } from "@/utils/texto";

// Pesquisa + Detalhes (US2) — paridade com o PDV: busca por código OU texto,
// resultados em cards, detalhe com capa/estoque/extrato/ajuste.
export default function PesquisaPage() {
  const [livros, setLivros] = useState<Livro[]>([]);
  const [saldos, setSaldos] = useState<Map<string, number>>(new Map());
  const [porCodigo, setPorCodigo] = useState("");
  const [porTexto, setPorTexto] = useState("");
  const [resultados, setResultados] = useState<Livro[] | null>(null);
  const [detalhe, setDetalhe] = useState<Livro | null>(null);
  const [refresh, setRefresh] = useState(0);

  async function carregarBase() {
    const [ls, ss] = await Promise.all([listarLivros(), listarSaldos()]);
    setLivros(ls);
    setSaldos(ss);
    return ss;
  }
  useEffect(() => {
    carregarBase();
  }, []);

  const est = (l: Livro) => saldos.get(l.sync_uid) ?? 0;

  function buscarCodigo() {
    const cod = porCodigo.trim();
    if (!cod) return;
    const l = livros.find((x) => x.codigo === cod);
    if (!l) return toast.error("Nenhum livro encontrado");
    setResultados(null);
    setDetalhe(l);
  }

  function buscarTexto() {
    const termo = porTexto.trim().toLowerCase();
    if (!termo) return;
    const ls = livros.filter((x) => `${x.titulo} ${x.autor ?? ""}`.toLowerCase().includes(termo));
    if (ls.length === 0) {
      toast.error("Nenhum livro encontrado");
      setResultados([]);
    } else if (ls.length === 1) {
      setDetalhe(ls[0]);
      setResultados(null);
    } else {
      setResultados(ls.slice(0, 60));
      setDetalhe(null);
    }
  }

  function copiar(codigo: string) {
    navigator.clipboard.writeText(codigo);
    toast.success("Código copiado");
  }

  if (detalhe) {
    const cat = CATEGORIAS.find((c) => c.id === detalhe.categoria);
    return (
      <div className="mx-auto max-w-2xl p-6">
        {resultados && (
          <Button variant="ghost" onClick={() => setDetalhe(null)} className="mb-3">
            ← Voltar aos resultados
          </Button>
        )}
        <div className="bg-card flex gap-5 rounded-xl border p-5">
          <Cover titulo={detalhe.titulo} tamanho="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{detalhe.titulo}</h1>
            {detalhe.autor && <div className="text-muted-foreground text-sm">{detalhe.autor}</div>}
            <div className="mt-2 flex items-center gap-3">
              <span className="font-mono text-2xl font-bold">{reais(detalhe.preco_centavos)}</span>
              <StockBadge estoque={est(detalhe)} />
            </div>
            <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Categoria</dt>
              <dd>{cat ? `${cat.id} — ${cat.nome}` : detalhe.categoria}</dd>
              <dt className="text-muted-foreground">Estoque</dt>
              <dd className="font-mono">{est(detalhe)}</dd>
              <dt className="text-muted-foreground">Código</dt>
              <dd className="flex items-center gap-2 font-mono">
                {detalhe.codigo}
                <button onClick={() => copiar(detalhe.codigo)} className="text-muted-foreground hover:text-foreground" title="Copiar">
                  <Copy size={14} />
                </button>
              </dd>
              {detalhe.descricao && (
                <>
                  <dt className="text-muted-foreground">Descrição</dt>
                  <dd>{detalhe.descricao}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <AjusteEstoque livroUid={detalhe.sync_uid} onAjustado={async () => { await carregarBase(); setRefresh((n) => n + 1); }} />
        </div>
        <ExtratoMovimentos livroUid={detalhe.sync_uid} refresh={refresh} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pesquisa</h1>
      <div className="bg-card mt-4 grid grid-cols-2 gap-4 rounded-xl border p-5">
        <div>
          <Label>Código de Barras</Label>
          <div className="mt-1 flex gap-2">
            <Input value={porCodigo} onChange={(e) => setPorCodigo(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && buscarCodigo()} className="h-9 font-mono" />
            <Button onClick={buscarCodigo} className="h-9">Pesquisar</Button>
          </div>
        </div>
        <div>
          <Label>Título ou Autor</Label>
          <div className="mt-1 flex gap-2">
            <Input value={porTexto} onChange={(e) => setPorTexto(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && buscarTexto()} className="h-9" />
            <Button onClick={buscarTexto} className="h-9">Pesquisar</Button>
          </div>
        </div>
      </div>

      {resultados && resultados.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {resultados.map((l) => (
            <button key={l.sync_uid} onClick={() => setDetalhe(l)} className="bg-card hover:bg-muted/50 flex gap-3 rounded-lg border p-3 text-left">
              <Cover titulo={l.titulo} tamanho="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{l.titulo}</div>
                {l.autor && <div className="text-muted-foreground truncate text-[12px]">{l.autor}</div>}
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-sm">{reais(l.preco_centavos)}</span>
                  <StockBadge estoque={est(l)} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
