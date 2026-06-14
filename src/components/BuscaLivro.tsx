// Busca de livro por título/autor no PDV (FR-010): input + dropdown de resultados.

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { StockBadge } from "@/components/StockBadge";
import { Cover } from "@/components/Cover";
import { brl } from "@/lib/format";
import { buscarPorTexto } from "@/lib/ipc";
import type { Livro } from "@/lib/types";

interface Props {
  numero: number | null;
  onSelect: (livro: Livro) => void;
}

export function BuscaLivro({ numero, onSelect }: Props) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Livro[]>([]);
  const [aberto, setAberto] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    const t = termo.trim();
    if (t.length < 2) {
      setResultados([]);
      setAberto(false);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        const ls = await buscarPorTexto(t);
        setResultados(ls.slice(0, 6));
        setAberto(true);
      } catch {
        setResultados([]);
      }
    }, 200);
    return () => window.clearTimeout(timer.current);
  }, [termo]);

  function escolher(l: Livro) {
    onSelect(l);
    setTermo("");
    setResultados([]);
    setAberto(false);
  }

  return (
    <div className="relative">
      <Input
        value={termo}
        onChange={(e) => setTermo(e.currentTarget.value)}
        placeholder={`Pesquisar para o Pedido Nº ${numero ?? "—"} — Título ou Autor`}
        className="h-9"
      />
      {aberto && resultados.length > 0 && (
        <div className="bg-popover absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border shadow-lg">
          {resultados.map((l) => (
            <button
              key={l.codigo}
              onClick={() => escolher(l)}
              className="hover:bg-muted/60 flex w-full items-center gap-2 border-b p-2 text-left last:border-b-0"
            >
              <Cover titulo={l.titulo} tamanho="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{l.titulo}</div>
                {l.autor && (
                  <div className="text-muted-foreground truncate text-[11px]">
                    {l.autor}
                  </div>
                )}
              </div>
              <StockBadge estoque={l.estoque} />
              <span className="font-mono text-sm">{brl(l.precoCentavos)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
