// Tela de Lançamentos (US3): lista de notas + "Novo lançamento". Abre o editor.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LancamentoEditor } from "@/components/LancamentoEditor";
import { brl } from "@/lib/format";
import { lancamentoCriar, lancamentosListar, type ErroIpc } from "@/lib/ipc";
import type { LancamentoResumo } from "@/lib/types";

const POR_PAGINA = 12;

function dataBr(iso: string) {
  return iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
}

export default function Lancamentos() {
  const [editorId, setEditorId] = useState<number | null>(null);
  const [itens, setItens] = useState<LancamentoResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);

  async function carregar(p: number) {
    try {
      const r = await lancamentosListar(p, POR_PAGINA); // ordenado da mais recente p/ a mais antiga
      setItens(r.itens);
      setTotal(r.total);
    } catch {
      setItens([]);
      setTotal(0);
    }
  }

  // Recarrega a página atual ao voltar do editor ou ao trocar de página.
  useEffect(() => {
    if (editorId === null) void carregar(pagina);
  }, [editorId, pagina]);

  async function novo() {
    try {
      const nota = await lancamentoCriar();
      setEditorId(nota.id);
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao criar lançamento");
    }
  }

  if (editorId !== null) {
    return <LancamentoEditor id={editorId} onFechar={() => setEditorId(null)} />;
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Lançamentos</h1>
        <Button onClick={novo} className="h-9">
          <Plus size={16} className="mr-1" /> Novo lançamento
        </Button>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        Notas de entrada por fornecedor. Salve como rascunho e dê entrada quando concluir.
      </p>

      <div className="bg-card mt-4 rounded-xl border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40%]">Fornecedor</TableHead>
              <TableHead className="w-[16%]">Data</TableHead>
              <TableHead className="w-[16%]">Status</TableHead>
              <TableHead className="w-[10%] text-right">Itens</TableHead>
              <TableHead className="w-[18%] text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((l) => (
              <TableRow
                key={l.id}
                className="cursor-pointer"
                onClick={() => setEditorId(l.id)}
              >
                <TableCell className="truncate">{l.fornecedorNome ?? "—"}</TableCell>
                <TableCell>{dataBr(l.data)}</TableCell>
                <TableCell>
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] ${
                      l.status === "finalizada"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : l.status === "cancelada"
                          ? "bg-muted text-muted-foreground line-through"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {l.status === "finalizada"
                      ? "Finalizada"
                      : l.status === "cancelada"
                        ? "Cancelada"
                        : "Rascunho"}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono">{l.qtdItens}</TableCell>
                <TableCell className="text-right font-mono">{brl(l.totalCentavos)}</TableCell>
              </TableRow>
            ))}
            {itens.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  Nenhum lançamento ainda. Clique em "Novo lançamento".
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > POR_PAGINA && (
        <div className="text-muted-foreground mt-3 flex items-center justify-end gap-2 text-sm">
          <span className="mr-2">{total} no total</span>
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            ‹
          </Button>
          <span className="tabular-nums">
            {pagina} / {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            ›
          </Button>
        </div>
      )}
    </div>
  );
}
