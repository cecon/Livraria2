// Campo único do PDV: digita código, título ou autor e já puxa até 10 matches.
// Enter: dígitos → busca exata por código (leitor); texto → 1º resultado.

import { useEffect, useRef, useState, type RefObject } from "react";
import { Input } from "@/components/ui/input";
import { StockBadge } from "@/components/StockBadge";
import { Cover } from "@/components/Cover";
import { brl } from "@/lib/format";
import { buscarPorTexto } from "@/lib/ipc";
import type { Livro } from "@/lib/types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelecionar: (livro: Livro) => void;
  onCodigoExato: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function EntradaProduto({
  value,
  onChange,
  onSelecionar,
  onCodigoExato,
  inputRef,
}: Props) {
  const [resultados, setResultados] = useState<Livro[]>([]);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    const t = value.trim();
    if (t.length < 2) {
      setResultados([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        setResultados((await buscarPorTexto(t)).slice(0, 10));
      } catch {
        setResultados([]);
      }
    }, 160);
    return () => window.clearTimeout(timer.current);
  }, [value]);

  function aoEnter() {
    const t = value.trim();
    if (/^\d+$/.test(t)) {
      onCodigoExato(); // leitor de código de barras
    } else if (resultados.length > 0) {
      onSelecionar(resultados[0]); // texto → melhor match
    } else {
      onCodigoExato();
    }
  }

  return (
    <div className="relative flex-1">
      <Input
        ref={inputRef}
        value={value}
        autoFocus
        onChange={(e) => onChange(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            aoEnter();
          }
        }}
        placeholder="Código, título ou autor"
        className="h-9 font-mono"
      />
      {resultados.length > 0 && (
        <div className="bg-popover absolute z-20 mt-1 max-h-96 w-full overflow-auto rounded-lg border shadow-lg">
          {resultados.map((l) => (
            <button
              key={l.codigo}
              onClick={() => onSelecionar(l)}
              className="hover:bg-muted/60 flex w-full items-center gap-2 border-b p-2 text-left last:border-b-0"
            >
              <Cover titulo={l.titulo} tamanho="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{l.titulo}</div>
                <div className="text-muted-foreground truncate text-[11px]">
                  {l.autor ? `${l.autor} · ` : ""}
                  <span className="font-mono">{l.codigo}</span>
                </div>
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
