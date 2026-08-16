// Lista de Vendas do dia — permite editar (excluir item) e cancelar a venda.
// Feature 013 (FR-003): cancelar/reabrir vale só para vendas do turno ABERTO
// deste PDV; as demais aparecem na lista, mas com as ações desligadas e o motivo
// à vista — melhor do que deixar o operador descobrir pelo erro.

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
import { pedidoNo } from "@/lib/pedido-numero";

const MOTIVO_FORA_DO_TURNO =
  "Esta venda é de um turno já fechado — a correção é feita no escritório.";

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
        `Reabrir a venda Nº ${pedidoNo(p)}? Ela será cancelada (estoque devolvido) e reaberta no PDV para edição.`,
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
      toast.success(`Venda Nº ${pedidoNo(p)} cancelada e reaberta para edição`);
      onClonar?.();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao reabrir a venda");
    }
  }

  async function delPedido(p: RelatorioVendas["pedidos"][number]) {
    if (!window.confirm(`Cancelar a venda Nº ${pedidoNo(p)} inteira?`)) return;
    try {
      await excluirPedido(p.numero);
      toast.success(`Venda Nº ${pedidoNo(p)} cancelada`);
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
            const pago = p.recebimentos.reduce((s, r) => s + r.valorCentavos, 0);
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
                    Pedido Nº {pedidoNo(p)} · {p.cliente}
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
                      {/* Feature 013 (FR-003): fora do turno aberto, a tela não
                          oferece o que o domínio vai recusar — diz o porquê. */}
                      {!p.cancelavel && (
                        <span
                          className="text-muted-foreground text-[11px]"
                          title={MOTIVO_FORA_DO_TURNO}
                        >
                          de outro turno
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={!p.cancelavel}
                        title={
                          p.cancelavel
                            ? "Reabrir venda (cancela e reabre no PDV para editar)"
                            : MOTIVO_FORA_DO_TURNO
                        }
                        onClick={() => reabrir(p)}
                      >
                        <RotateCcw size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-500 hover:text-rose-600"
                        disabled={!p.cancelavel}
                        title={p.cancelavel ? "Cancelar venda inteira" : MOTIVO_FORA_DO_TURNO}
                        onClick={() => delPedido(p)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </>
                  )}
                </div>
                <ul className="text-muted-foreground mt-1">
                  {p.itens.map((i) => (
                    <li key={i.id} className="font-mono text-[12px]">
                      <div className="flex items-center gap-2">
                        <span className="flex-1">
                          {i.qtd}× {i.titulo}
                        </span>
                        <span>{brl(i.valorCentavos)}</span>
                      </div>
                      {i.alocacoes.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {i.alocacoes.map((a) => (
                            <span
                              key={a.destinacaoId}
                              className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]"
                              title={brl(a.valorCentavos)}
                            >
                              {a.qtd} un. {a.nome}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {pago > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t pt-2 font-mono text-[11px] text-[#1f7a4d]">
                    {p.recebimentos.map((r) => (
                      <span key={r.formaId}>
                        {r.rotulo} {brl(r.valorCentavos)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
