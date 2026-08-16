// Cartão de uma venda — itens, alocações e recebimentos por forma.
// Extraído de `RelatoriosViews` para ser o MESMO cartão na tela inicial do PDV
// (feature 013, FR-022): a lista do turno e a do relatório não podem divergir.

import { brl } from "@/lib/format";
import type { PedidoRelatorio } from "@/lib/ipc";
import { pedidoNo } from "@/lib/pedido-numero";

export function CartaoVenda({ p }: { p: PedidoRelatorio }) {
  const pago = p.recebimentos.reduce((s, r) => s + r.valorCentavos, 0);
  const divergente = pago !== p.totalCentavos;
  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        p.cancelado ? "opacity-60" : divergente ? "border-rose-500 ring-1 ring-rose-500" : ""
      }`}
    >
      <div className="flex items-center justify-between font-medium">
        <span className={p.cancelado ? "line-through" : undefined}>
          Pedido Nº {pedidoNo(p)} · {p.cliente}
        </span>
        {p.cancelado ? (
          <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] uppercase">
            cancelada
          </span>
        ) : (
          divergente && (
            <span className="text-[11px] font-normal text-rose-600">
              ⚠ Pago {brl(pago)} ≠ Total {brl(p.totalCentavos)}
            </span>
          )
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
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 font-mono text-[12px] text-[#1f7a4d]">
        {p.recebimentos.map((r) => (
          <span key={r.formaId}>
            {r.rotulo} {brl(r.valorCentavos)}
          </span>
        ))}
        <span className="ml-auto font-semibold">Total {brl(p.totalCentavos)}</span>
      </div>
    </div>
  );
}
