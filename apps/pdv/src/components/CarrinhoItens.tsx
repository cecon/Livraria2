import { Minus, Plus, ScanBarcode, Trash2 } from "lucide-react";
import { Button } from "@livraria/ui/wowdash/button";
import { Card, CardContent } from "@livraria/ui/wowdash/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/wowdash/table";
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

export function CarrinhoItens({ itens, onAlterar, onRemover }: Props) {
  return <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-lg py-0">
    <CardContent className="flex min-h-0 flex-1 flex-col overflow-auto px-0">
      <Table className="min-w-[650px] border-separate border-spacing-0">
        <TableHeader className="[&_th]:border-b [&_th]:border-neutral-200 dark:[&_th]:border-slate-600"><TableRow className="border-0">
          <TableHead className="h-12 bg-neutral-100 px-4 dark:bg-slate-700">Título</TableHead>
          <TableHead className="h-12 bg-neutral-100 px-4 text-right dark:bg-slate-700">Preço</TableHead>
          <TableHead className="h-12 bg-neutral-100 px-4 text-center dark:bg-slate-700">Quantidade</TableHead>
          <TableHead className="h-12 bg-neutral-100 px-4 text-right dark:bg-slate-700">Total</TableHead>
          <TableHead className="h-12 bg-neutral-100 px-4 text-center dark:bg-slate-700"><span className="sr-only">Ações</span></TableHead>
        </TableRow></TableHeader>
        <TableBody className="[&_td]:border-b [&_td]:border-neutral-200 dark:[&_td]:border-slate-600">{itens.map((item) => <TableRow key={item.codigo}>
          <TableCell className="min-w-52 px-4 py-3">
            <div className="font-medium">{item.titulo}</div>
            <div className="text-xs text-muted-foreground">{item.codigo}</div>
          </TableCell>
          <TableCell className="px-4 py-3 text-right tabular-nums">{brl(item.precoCentavos)}</TableCell>
          <TableCell className="px-4 py-3">
            <div className="flex items-center justify-center gap-1">
              <Button type="button" variant="outline" size="icon" className="size-8" aria-label={`Diminuir quantidade de ${item.titulo}`}
                onClick={() => onAlterar(item.codigo, -1)} disabled={item.qtd <= 1}><Minus /></Button>
              <span className="w-8 text-center tabular-nums">{item.qtd}</span>
              <Button type="button" variant="outline" size="icon" className="size-8" aria-label={`Aumentar quantidade de ${item.titulo}`}
                onClick={() => onAlterar(item.codigo, 1)}><Plus /></Button>
            </div>
          </TableCell>
          <TableCell className="px-4 py-3 text-right font-medium tabular-nums">{brl(item.precoCentavos * item.qtd)}</TableCell>
          <TableCell className="px-4 py-3 text-center">
            <Button type="button" variant="ghost" size="icon" className="size-8 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-600/20"
              aria-label={`Remover ${item.titulo}`} title="Remover item" onClick={() => onRemover(item.codigo)}><Trash2 /></Button>
          </TableCell>
        </TableRow>)}</TableBody>
      </Table>
      {itens.length === 0 ? <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <ScanBarcode size={40} className="text-brand opacity-70" aria-hidden="true" />
        <div className="text-base font-semibold">Caixa livre</div>
        <p className="text-sm text-muted-foreground">Bipe um código de barras ou busque pelo título para iniciar a venda.</p>
      </div> : null}
    </CardContent>
  </Card>;
}
