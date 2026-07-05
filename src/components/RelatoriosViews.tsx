// Visualizações dos relatórios emitidos (US5, FR-042/043).

import { brl } from "@/lib/format";
import type { RelatorioDestinacoes } from "@/lib/types";
import { CATEGORIAS } from "@/lib/types";
import type { RelatorioEstoque, RelatorioVendas } from "@/lib/ipc";

const PERIODO_ROTULO: Record<string, string> = {
  dia: "Dia Inteiro",
  manha: "Turma da Manhã",
  tarde: "Turma da Tarde",
};

interface VendasProps {
  rel: RelatorioVendas;
}

export function VendasView({ rel }: VendasProps) {
  const ativos = rel.pedidos.filter((p) => !p.cancelado);
  const canceladas = rel.pedidos.filter((p) => p.cancelado);
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        Relatório de Vendas — {PERIODO_ROTULO[rel.periodo] ?? rel.periodo} — {rel.data}
      </h2>

      {ativos.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma venda no período.</p>
      ) : (
        ativos.map((p) => {
          const pago = p.recebimentos.reduce((s, r) => s + r.valorCentavos, 0);
          const divergente = pago !== p.totalCentavos;
          return (
          <div
            key={p.numero}
            className={`rounded-lg border p-3 text-sm ${
              divergente ? "border-rose-500 ring-1 ring-rose-500" : ""
            }`}
          >
            <div className="flex items-center justify-between font-medium">
              <span>
                Pedido Nº {p.numero} · {p.cliente}
              </span>
              {divergente && (
                <span className="text-[11px] font-normal text-rose-600">
                  ⚠ Pago {brl(pago)} ≠ Total {brl(p.totalCentavos)}
                </span>
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
        })
      )}

      {canceladas.length > 0 && (
        <div className="rounded-lg border border-dashed p-3 text-sm">
          <div className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase">
            Canceladas (não somadas) — {canceladas.length}
          </div>
          <ul className="space-y-1 font-mono text-[12px]">
            {canceladas.map((p) => (
              <li key={p.numero} className="text-muted-foreground flex justify-between">
                <span>
                  Nº {p.numero} · {p.cliente}
                </span>
                <span className="line-through">{brl(p.totalCentavos)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-muted/40 rounded-lg p-4">
        <div className="mb-2 text-sm font-semibold">Resumo das Vendas</div>
        <div className="space-y-1 font-mono text-sm">
          {rel.resumo.formas.map((f) => (
            <Linha key={f.formaId} rotulo={`Total ${f.rotulo}`} v={f.totalCentavos} />
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t pt-2 font-mono text-base font-bold">
          <span>Total das Vendas (todas as formas)</span>
          <span>{brl(rel.resumo.subtotalCentavos)}</span>
        </div>
      </div>
    </div>
  );
}

function Linha({ rotulo, v }: { rotulo: string; v: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{rotulo}</span>
      <span>{brl(v)}</span>
    </div>
  );
}

export function EstoqueView({ rel }: { rel: RelatorioEstoque }) {
  const cat = (id: number) => CATEGORIAS.find((c) => c.id === id)?.nome ?? String(id);
  return (
    <div>
      <h2 className="text-lg font-semibold">Relatório de Estoque</h2>
      <p className="text-muted-foreground text-sm">
        {rel.titulos} títulos · Valor em estoque: {brl(rel.valorTotalCentavos)}
      </p>
      <table className="mt-3 w-full text-sm">
        <thead className="text-muted-foreground text-[11px] uppercase">
          <tr className="border-b text-left">
            <th className="py-1">Código</th>
            <th>Título</th>
            <th>Categoria</th>
            <th className="text-right">Preço</th>
            <th className="text-right">Estoque</th>
            <th className="text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rel.itens.map((i) => (
            <tr key={i.codigo} className="border-b">
              <td className="py-1 font-mono text-[12px]">{i.codigo}</td>
              <td className="max-w-[220px] truncate">{i.titulo}</td>
              <td className="text-[12px]">{cat(i.categoria)}</td>
              <td className="text-right font-mono">{brl(i.precoCentavos)}</td>
              <td className="text-right font-mono">{i.estoque}</td>
              <td className="text-right font-mono">{brl(i.valorCentavos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Relatório por destinação (US2 — FR-016/FR-018): valores do período + posição atual. */
export function DestinacoesView({ rel }: { rel: RelatorioDestinacoes }) {
  return (
    <div className="bg-card rounded-xl border p-5">
      <h2 className="text-lg font-semibold">Vendas por Destinação</h2>
      <p className="text-muted-foreground text-sm">
        {rel.inicio === rel.fim ? rel.inicio : `${rel.inicio} a ${rel.fim}`}
      </p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-[11px] uppercase">
            <th className="py-1.5">Destinação</th>
            <th className="py-1.5 text-right">Unidades</th>
            <th className="py-1.5 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rel.linhas.map((l) => (
            <tr key={l.destinacaoId} className="border-b last:border-0">
              <td className="py-1.5">{l.nome}</td>
              <td className="py-1.5 text-right font-mono">{l.qtd}</td>
              <td className="py-1.5 text-right font-mono">{brl(l.valorCentavos)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-2">Total</td>
            <td />
            <td className="py-2 text-right font-mono">{brl(rel.totalCentavos)}</td>
          </tr>
        </tfoot>
      </table>

      <h3 className="mt-5 text-sm font-semibold">Posição atual dos carimbos</h3>
      <p className="text-muted-foreground text-[11px]">
        Unidades ainda reservadas por destinação (todos os livros) — independe do período.
      </p>
      {rel.posicaoAtual.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">
          Nenhum saldo carimbado no momento.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {rel.posicaoAtual.map((pos) => (
            <span
              key={pos.destinacaoId}
              className="bg-muted rounded px-2 py-1 font-mono text-[12px]"
            >
              {pos.nome}: {pos.qtd}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
