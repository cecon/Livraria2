"use client";

import { useMemo, useState, type RefObject } from "react";
import { Input } from "@livraria/ui/ui/input";
import { StockBadge } from "@/components/StockBadge";
import { Cover } from "@/components/Cover";
import { reais } from "@/utils/texto";

export type LivroBusca = { sync_uid: string; codigo: string; titulo: string; autor: string | null; preco_centavos: number; estoque: number };

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelecionar: (l: LivroBusca) => void;
  onCodigoExato: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  livros: LivroBusca[];
}

// Campo único: digita código, título ou autor e puxa até 10 matches. Enter:
// dígitos → código exato; texto → item destacado.
export function EntradaProduto({ value, onChange, onSelecionar, onCodigoExato, inputRef, livros }: Props) {
  const [ativo, setAtivo] = useState(0);
  const resultados = useMemo(() => {
    const t = value.trim().toLowerCase();
    if (t.length < 2) return [];
    return livros.filter((l) => `${l.titulo} ${l.autor ?? ""} ${l.codigo}`.toLowerCase().includes(t)).slice(0, 10);
  }, [value, livros]);

  function aoEnter() {
    const t = value.trim();
    if (/^\d+$/.test(t) && resultados.length === 0) return onCodigoExato();
    if (resultados.length > 0) onSelecionar(resultados[Math.min(ativo, resultados.length - 1)] ?? resultados[0]);
    else onCodigoExato();
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
          } else if (e.key === "ArrowDown" && resultados.length > 0) {
            e.preventDefault();
            setAtivo((a) => Math.min(a + 1, resultados.length - 1));
          } else if (e.key === "ArrowUp" && resultados.length > 0) {
            e.preventDefault();
            setAtivo((a) => Math.max(a - 1, 0));
          }
        }}
        placeholder="Código, título ou autor"
        className="h-9 font-mono"
      />
      {resultados.length > 0 && (
        <div className="bg-popover absolute z-20 mt-1 max-h-96 w-full overflow-auto rounded-lg border shadow-lg">
          {resultados.map((l, idx) => (
            <button
              key={l.sync_uid}
              onMouseEnter={() => setAtivo(idx)}
              onClick={() => onSelecionar(l)}
              className={`flex w-full items-center gap-2 border-b p-2 text-left last:border-b-0 ${idx === Math.min(ativo, resultados.length - 1) ? "bg-muted" : "hover:bg-muted/60"}`}
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
              <span className="font-mono text-sm">{reais(l.preco_centavos)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
