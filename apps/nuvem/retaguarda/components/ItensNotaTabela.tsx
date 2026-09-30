"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/interface/ui/table";

import { Cover } from "./Cover";
import { Trash2 } from "lucide-react";
import { reais } from "@/utils/texto";
import type { ItemNota } from "@/lib/nuvem/lancamento";

export function ItensNotaTabela({ itens, lendo, onRemover }: { itens: ItemNota[]; lendo: boolean; onRemover: (itemUid: string) => void }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border">
      <Table className="w-full text-sm">
        <TableHeader className="bg-muted/50 text-muted-foreground">
          <TableRow>
            <TableHead className="p-2 text-left font-medium">Livro</TableHead>
            <TableHead className="p-2 text-right font-medium">Qtd</TableHead>
            <TableHead className="p-2 text-right font-medium">Custo un.</TableHead>
            <TableHead className="p-2 text-right font-medium">Subtotal</TableHead>
            {!lendo && <TableHead className="w-10 p-2" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((i) => (
            <TableRow key={i.sync_uid} className="border-t">
              <TableCell className="p-2"><div className="flex items-center gap-3"><Cover titulo={i.titulo} capaUid={i.capaUid} tamanho="sm" /><span>{i.titulo}</span></div></TableCell>
              <TableCell className="p-2 text-right font-mono">{i.qtd}</TableCell>
              <TableCell className="p-2 text-right font-mono">{reais(i.custoUnitCentavos)}</TableCell>
              <TableCell className="p-2 text-right font-mono">{reais(i.subtotalCentavos)}</TableCell>
              {!lendo && (
                <TableCell className="p-2 text-right">
                  <button onClick={() => onRemover(i.sync_uid)} className="text-rose-500 hover:text-rose-600" title="Remover">
                    <Trash2 size={14} />
                  </button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {itens.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground p-4 text-center">Nenhum item ainda.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
