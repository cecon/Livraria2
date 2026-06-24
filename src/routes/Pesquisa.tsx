// Tela Pesquisa + Detalhes (US3, FR-020..023).

import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StockBadge } from "@/components/StockBadge";
import { Cover } from "@/components/Cover";
import { AjusteEstoque } from "@/components/AjusteEstoque";
import { ExtratoMovimentos } from "@/components/ExtratoMovimentos";
import { brl } from "@/lib/format";
import { CATEGORIAS, type Livro } from "@/lib/types";
import { buscarPorTexto, livroPorCodigo, type ErroIpc } from "@/lib/ipc";

export default function Pesquisa() {
  const [porCodigo, setPorCodigo] = useState("");
  const [porTexto, setPorTexto] = useState("");
  const [resultados, setResultados] = useState<Livro[] | null>(null);
  const [detalhe, setDetalhe] = useState<Livro | null>(null);
  const [refresh, setRefresh] = useState(0);

  async function buscarCodigo() {
    const cod = porCodigo.trim();
    if (!cod) return;
    try {
      const l = await livroPorCodigo(cod);
      if (!l) {
        toast.error("Nenhum livro encontrado");
        return;
      }
      setResultados(null);
      setDetalhe(l);
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro na busca");
    }
  }

  async function buscarTexto() {
    const termo = porTexto.trim();
    if (!termo) return;
    try {
      const ls = await buscarPorTexto(termo);
      if (ls.length === 0) {
        toast.error("Nenhum livro encontrado");
        setResultados([]);
      } else if (ls.length === 1) {
        setDetalhe(ls[0]);
        setResultados(null);
      } else {
        setResultados(ls);
        setDetalhe(null);
      }
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro na busca");
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
            {detalhe.autor && (
              <div className="text-muted-foreground text-sm">{detalhe.autor}</div>
            )}
            <div className="mt-2 flex items-center gap-3">
              <span className="font-mono text-2xl font-bold">
                {brl(detalhe.precoCentavos)}
              </span>
              <StockBadge estoque={detalhe.estoque} />
            </div>
            <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Categoria</dt>
              <dd>{cat ? `${cat.id} — ${cat.nome}` : detalhe.categoria}</dd>
              <dt className="text-muted-foreground">Estoque</dt>
              <dd className="font-mono">{detalhe.estoque}</dd>
              <dt className="text-muted-foreground">Código</dt>
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
                  <dt className="text-muted-foreground">Descrição</dt>
                  <dd>{detalhe.descricao}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <AjusteEstoque
            livro={detalhe}
            onAjustado={(l) => {
              setDetalhe(l);
              setRefresh((n) => n + 1);
            }}
          />
        </div>
        <ExtratoMovimentos codigo={detalhe.codigo} refresh={refresh} />
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
          <Label>Título ou Autor</Label>
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
          {resultados.map((l) => (
            <button
              key={l.codigo}
              onClick={() => setDetalhe(l)}
              className="bg-card hover:bg-muted/50 flex gap-3 rounded-lg border p-3 text-left"
            >
              <Cover titulo={l.titulo} tamanho="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{l.titulo}</div>
                {l.autor && (
                  <div className="text-muted-foreground truncate text-[12px]">
                    {l.autor}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-sm">{brl(l.precoCentavos)}</span>
                  <StockBadge estoque={l.estoque} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
