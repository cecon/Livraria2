// Tabela de itens de uma nota de entrada (extraída de LancamentoEditor).

import { Trash2 } from "lucide-react";
import { brl } from "@/lib/format";
import type { ItemNota } from "@/lib/types";

interface Props {
  itens: ItemNota[];
  lendo: boolean;
  onRemover: (itemId: number) => void;
}

export function ItensNotaTabela({ itens, lendo, onRemover }: Props) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="p-2 text-left font-medium">Livro</th>
            <th className="p-2 text-right font-medium">Qtd</th>
            <th className="p-2 text-right font-medium">Custo un.</th>
            <th className="p-2 text-right font-medium">Subtotal</th>
            {!lendo && <th className="w-10 p-2" />}
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.itemId} className="border-t">
              <td className="p-2">{i.titulo}</td>
              <td className="p-2 text-right font-mono">{i.qtd}</td>
              <td className="p-2 text-right font-mono">{brl(i.custoUnitCentavos)}</td>
              <td className="p-2 text-right font-mono">{brl(i.subtotalCentavos)}</td>
              {!lendo && (
                <td className="p-2 text-right">
                  <button
                    onClick={() => onRemover(i.itemId)}
                    className="text-rose-500 hover:text-rose-600"
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {itens.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted-foreground p-4 text-center">
                Nenhum item ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
