// Tabela de itens do PDV (US1): título, preço, stepper de qtd, total, remover.

import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";

export interface ItemCarrinho {
  codigo: string;
  titulo: string;
  precoCentavos: number;
  qtd: number;
}

interface Props {
  itens: ItemCarrinho[];
  onAlterar: (codigo: string, delta: number) => void;
  onRemover: (codigo: string) => void;
}

const GRID = "grid grid-cols-[1fr_96px_128px_100px_52px]";

export function CarrinhoItens({ itens, onAlterar, onRemover }: Props) {
  return (
    <div className="bg-card flex-1 overflow-auto rounded-xl border">
      <div
        className={`${GRID} text-muted-foreground border-b px-4 py-2 text-[11px] uppercase`}
      >
        <span>Título</span>
        <span className="text-right">Preço</span>
        <span className="text-center">Quantidade</span>
        <span className="text-right">Total</span>
        <span />
      </div>

      {itens.length === 0 ? (
        <div className="text-muted-foreground p-8 text-center text-sm">
          Escaneie um código de barras ou busque pelo título para começar.
        </div>
      ) : (
        itens.map((i) => (
          <div key={i.codigo} className={`${GRID} items-center border-b px-4 py-2 text-sm`}>
            <div className="min-w-0">
              <div className="truncate">{i.titulo}</div>
              <div className="text-muted-foreground font-mono text-[11px]">{i.codigo}</div>
            </div>
            <span className="text-right font-mono">{brl(i.precoCentavos)}</span>
            <div className="flex items-center justify-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => onAlterar(i.codigo, -1)}
              >
                <Minus size={14} />
              </Button>
              <span className="w-8 text-center font-mono">{i.qtd}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => onAlterar(i.codigo, 1)}
              >
                <Plus size={14} />
              </Button>
            </div>
            <span className="text-right font-mono">{brl(i.precoCentavos * i.qtd)}</span>
            <button
              onClick={() => onRemover(i.codigo)}
              className="text-rose-500 hover:text-rose-600"
              title="Remover"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
