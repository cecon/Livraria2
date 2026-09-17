"use client";

import { useCallback, useEffect, useState } from "react";
import { ReceiptText, RefreshCw } from "lucide-react";
import { Button } from "@livraria/ui/wowdash/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/wowdash/table";
import { LoadFailure } from "@/components/LoadFailure";
import { listarVendasDoDia, type VendaResumo } from "@/lib/nuvem/venda";
import { reais } from "@/utils/texto";

export default function VendasPage() {
  const [vendas, setVendas] = useState<VendaResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const carregar = useCallback(async () => {
    try {
      setVendas(await listarVendasDoDia());
      setErro(null);
      setAtualizadoEm(new Date());
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Vendas indisponíveis.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void carregar();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [carregar]);

  return <div className="space-y-4 px-4 py-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold"><ReceiptText size={20} /> Vendas dos PDVs</h1>
        <p className="text-muted-foreground mt-1 text-sm">Vendas de hoje recebidas da sincronização.{atualizadoEm && ` Atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR")}.`}</p>
      </div>
      <Button variant="outline" onClick={() => void carregar()} aria-label="Atualizar vendas" title="Atualizar vendas"><RefreshCw size={16} /> Atualizar</Button>
    </div>
    {erro && <LoadFailure title="Não foi possível atualizar as vendas" message={erro} onRetry={carregar} />}
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b px-4 py-3 text-sm font-semibold">Últimas vendas recebidas <span className="text-muted-foreground font-normal">· {vendas.length}</span></div>
      <Table>
        <TableHeader><TableRow className="bg-muted/40">
          <TableHead className="px-4">Pedido</TableHead><TableHead>Máquina / operador</TableHead>
          <TableHead className="hidden sm:table-cell">Cliente</TableHead><TableHead className="hidden md:table-cell">Recebida</TableHead>
          <TableHead className="px-4 text-right">Total</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {vendas.map((venda) => <TableRow key={venda.sync_uid}>
            <TableCell className="px-4 font-medium">Nº {venda.numeroNoTurno ?? venda.numero}</TableCell>
            <TableCell><div>{venda.maquina}</div><div className="text-muted-foreground text-xs">{venda.operador}</div></TableCell>
            <TableCell className="hidden sm:table-cell">{venda.cliente}</TableCell>
            <TableCell className="hidden md:table-cell">{new Date(venda.recebidoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</TableCell>
            <TableCell className="px-4 text-right tabular-nums"><span className={venda.cancelado ? "text-muted-foreground line-through" : ""}>{reais(venda.totalCentavos)}</span>{venda.cancelado && <span className="block text-xs text-red-600">Cancelada</span>}</TableCell>
          </TableRow>)}
          {!carregando && vendas.length === 0 && <TableRow><TableCell colSpan={5} className="p-8 text-center text-muted-foreground">Nenhuma venda recebida hoje.</TableCell></TableRow>}
        </TableBody>
      </Table>
      {carregando && <p className="p-8 text-center text-sm text-muted-foreground">Carregando vendas…</p>}
    </div>
  </div>;
}
