// Tela de pesquisa operacional do PDV.

import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Cover } from "@/components/Cover";
import { ExtratoMovimentos } from "@/components/ExtratoMovimentos";
import { StockBadge } from "@/components/StockBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/format";
import { buscarPorTexto, livroPorCodigo, type ErroIpc } from "@/lib/ipc";
import { CATEGORIAS, type Livro } from "@/lib/types";

function saldoOperacional(livro: Livro) {
  return livro.saldoOperacional ?? livro.estoque;
}

export default function Pesquisa() {
  const [porCodigo, setPorCodigo] = useState("");
  const [porTexto, setPorTexto] = useState("");
  const [resultados, setResultados] = useState<Livro[] | null>(null);
  const [detalhe, setDetalhe] = useState<Livro | null>(null);

  async function buscarCodigo() {
    const cod = porCodigo.trim();
    if (!cod) return;
    try {
      const livro = await livroPorCodigo(cod);
      if (!livro) {
        toast.error("Nenhum livro encontrado");
        return;
      }
      setResultados(null);
      setDetalhe(livro);
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro na busca");
    }
  }

  async function buscarTexto() {
    const termo = porTexto.trim();
    if (!termo) return;
    try {
      const livros = await buscarPorTexto(termo);
      if (livros.length === 0) {
        toast.error("Nenhum livro encontrado");
        setResultados([]);
      } else if (livros.length === 1) {
        setDetalhe(livros[0]);
        setResultados(null);
      } else {
        setResultados(livros);
        setDetalhe(null);
      }
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro na busca");
    }
  }

  function copiar(codigo: string) {
    navigator.clipboard.writeText(codigo);
    toast.success("Codigo copiado");
  }

  if (detalhe) {
    const cat = CATEGORIAS.find((c) => c.id === detalhe.categoria);
    return (
      <div className="mx-auto max-w-2xl p-6">
        {resultados && (
          <Button variant="ghost" onClick={() => setDetalhe(null)} className="mb-3">
            Voltar aos resultados
          </Button>
        )}
        <div className="bg-card flex gap-5 rounded-xl border p-5">
          <Cover titulo={detalhe.titulo} tamanho="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{detalhe.titulo}</h1>
            {detalhe.autor && (
              <div className="text-muted-foreground text-sm">{detalhe.autor}</div>
            )}
            <div className="mt-2 flex items-center gap-3">
              <span className="font-mono text-2xl font-bold">
                {brl(detalhe.precoCentavos)}
              </span>
              <StockBadge estoque={saldoOperacional(detalhe)} rotulo="Saldo op." />
            </div>
            <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Categoria</dt>
              <dd>{cat ? `${cat.id} - ${cat.nome}` : detalhe.categoria}</dd>
              <dt className="text-muted-foreground">Saldo op.</dt>
              <dd className="font-mono">{saldoOperacional(detalhe)}</dd>
              <dt className="text-muted-foreground">Codigo</dt>
              <dd className="flex items-center gap-2 font-mono">
                {detalhe.codigo}
                <button
                  onClick={() => copiar(detalhe.codigo)}
                  className="text-muted-foreground hover:text-foreground"
                  title="Copiar"
                >
                  <Copy size={14} />
                </button>
              </dd>
              {detalhe.descricao && (
                <>
                  <dt className="text-muted-foreground">Descricao</dt>
                  <dd>{detalhe.descricao}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
        <div className="border-border bg-muted/40 text-muted-foreground mt-4 rounded-lg border p-3 text-sm">
          Cadastro, lancamentos, inventario e ajustes oficiais de estoque agora
          ficam no Escritorio/nuvem. No PDV esta tela e apenas consulta
          operacional para venda.
        </div>
        <ExtratoMovimentos codigo={detalhe.codigo} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pesquisa</h1>
      <div className="border-border bg-muted/40 text-muted-foreground mt-3 rounded-lg border p-3 text-sm">
        O estoque oficial e administrado no Escritorio/nuvem. O PDV mostra saldo
        operacional simples para apoiar a venda offline.
      </div>
      <div className="bg-card mt-4 grid grid-cols-2 gap-4 rounded-xl border p-5">
        <div>
          <Label>Codigo de barras</Label>
          <div className="mt-1 flex gap-2">
            <Input
              value={porCodigo}
              onChange={(e) => setPorCodigo(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && buscarCodigo()}
              className="h-9 font-mono"
            />
            <Button onClick={buscarCodigo} className="h-9">
              Pesquisar
            </Button>
          </div>
        </div>
        <div>
          <Label>Titulo ou autor</Label>
          <div className="mt-1 flex gap-2">
            <Input
              value={porTexto}
              onChange={(e) => setPorTexto(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && buscarTexto()}
              className="h-9"
            />
            <Button onClick={buscarTexto} className="h-9">
              Pesquisar
            </Button>
          </div>
        </div>
      </div>

      {resultados && resultados.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {resultados.map((livro) => (
            <button
              key={livro.codigo}
              onClick={() => setDetalhe(livro)}
              className="bg-card hover:bg-muted/50 flex gap-3 rounded-lg border p-3 text-left"
            >
              <Cover titulo={livro.titulo} tamanho="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{livro.titulo}</div>
                {livro.autor && (
                  <div className="text-muted-foreground truncate text-[12px]">
                    {livro.autor}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-sm">
                    {brl(livro.precoCentavos)}
                  </span>
                  <StockBadge estoque={saldoOperacional(livro)} rotulo="Saldo op." />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
