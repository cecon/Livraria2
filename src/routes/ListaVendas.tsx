// Lista de Vendas do dia — permite editar (excluir item) e cancelar a venda.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/format";
import { PAG_VAZIO, RASCUNHO_KEY } from "@/lib/venda";
import {
  excluirPedido,
  relatorioVendas,
  type ErroIpc,
  type RelatorioVendas,
} from "@/lib/ipc";

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function ListaVendas({ onClonar }: { onClonar?: () => void } = {}) {
  const [data, setData] = useState(hojeIso());
  const [rel, setRel] = useState<RelatorioVendas | null>(null);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function carregar() {
    try {
      setRel(await relatorioVendas(data, "dia"));
    } catch {
      setRel(null);
    }
  }

  // Reabrir = cancela a venda (devolve estoque) e reabre um CLONE no PDV para
  // edição. Evita editar item de venda finalizada (quebraria as formas de pagamento).
  async function reabrir(p: RelatorioVendas["pedidos"][number]) {
    if (
      !window.confirm(
        `Reabrir a venda Nº ${p.numero}? Ela será cancelada (estoque devolvido) e reaberta no PDV para edição.`,
      )
    ) {
      return;
    }
    try {
      await excluirPedido(p.numero);
      const rascunho = {
        cliente: p.cliente,
        itens: p.itens.map((i) => ({
          codigo: i.codigo,
          titulo: i.titulo,
          precoCentavos: Math.round(i.valorCentavos / i.qtd),
          qtd: i.qtd,
        })),
        pag: PAG_VAZIO,
      };
      localStorage.setItem(RASCUNHO_KEY, JSON.stringify(rascunho));
      toast.success(`Venda Nº ${p.numero} cancelada e reaberta para edição`);
      onClonar?.();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao reabrir a venda");
    }
  }

  async function delPedido(numero: number) {
    if (!window.confirm(`Cancelar a venda Nº ${numero} inteira?`)) return;
    try {
      await excluirPedido(numero);
      toast.success(`Venda Nº ${numero} cancelada`);
      carregar();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao cancelar a venda");
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vendas do dia</h1>
          {rel && (
            <p className="text-muted-foreground text-sm">
              {rel.pedidos.filter((p) => !p.cancelado).length} vendas · Total{" "}
              {brl(rel.resumo.subtotalCentavos)}
              {rel.pedidos.some((p) => p.cancelado) &&
                ` · ${rel.pedidos.filter((p) => p.cancelado).length} cancelada(s)`}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="data">Data</Label>
          <Input
            id="data"
            type="date"
            value={data}
            onChange={(e) => setData(e.currentTarget.value)}
            className="mt-1 h-9"
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {!rel || rel.pedidos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma venda nesta data.</p>
        ) : (
          rel.pedidos.map((p) => {
            const pago = p.cartao + p.dinheiro + p.pix + p.ministerio + p.vale;
            const divergente = pago !== p.totalCentavos;
            return (
              <div
                key={p.numero}
                className={`bg-card rounded-lg border p-3 text-sm ${
                  p.cancelado
                    ? "opacity-60"
                    : divergente
                      ? "border-rose-500 ring-1 ring-rose-500"
                      : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    Pedido Nº {p.numero} · {p.cliente}
                  </span>
                  {p.cancelado && (
                    <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] uppercase">
                      cancelada
                    </span>
                  )}
                  {divergente && !p.cancelado && (
                    <span className="text-[11px] text-rose-600">
                      ⚠ Pago {brl(pago)} ≠ Total {brl(p.totalCentavos)}
                    </span>
                  )}
                  <span
                    className={`ml-auto font-mono font-semibold ${
                      p.cancelado ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {brl(p.totalCentavos)}
                  </span>
                  {!p.cancelado && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Reabrir venda (cancela e reabre no PDV para editar)"
                        onClick={() => reabrir(p)}
                      >
                        <RotateCcw size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-500 hover:text-rose-600"
                        title="Cancelar venda inteira"
                        onClick={() => delPedido(p.numero)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </>
                  )}
                </div>
                <ul className="text-muted-foreground mt-1">
                  {p.itens.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 font-mono text-[12px]">
                      <span className="flex-1">
                        {i.qtd}× {i.titulo}
                      </span>
                      <span>{brl(i.valorCentavos)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
