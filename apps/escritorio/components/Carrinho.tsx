"use client";

// Carrinho da venda (feature 009, US2) — itens, quantidade (+/−) e remoção.
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { reais } from "@/utils/texto";
import type { ItemVenda } from "@/lib/nuvem/venda";

export function Carrinho({
  itens,
  onQtd,
  onRemover,
}: {
  itens: ItemVenda[];
  onQtd: (codigo: string, delta: number) => void;
  onRemover: (codigo: string) => void;
}) {
  if (itens.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">Carrinho vazio. Busque um item acima.</p>;
  }
  return (
    <div className="divide-y">
      {itens.map((it) => (
        <div key={it.codigo} className="flex items-center gap-2 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{it.titulo}</div>
            <div className="text-muted-foreground truncate text-[11px]">
              <span className="font-mono">{it.codigo}</span> · {reais(it.precoCentavos)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Menos" onClick={() => onQtd(it.codigo, -1)}>
              <Minus size={14} />
            </Button>
            <span className="w-6 text-center tabular-nums text-sm">{it.qtd}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Mais" onClick={() => onQtd(it.codigo, 1)}>
              <Plus size={14} />
            </Button>
          </div>
          <span className="w-20 text-right tabular-nums text-sm font-medium">{reais(it.precoCentavos * it.qtd)}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600" title="Remover" onClick={() => onRemover(it.codigo)}>
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
    </div>
  );
}
