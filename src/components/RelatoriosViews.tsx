// Visualizações dos relatórios emitidos (US5, FR-042/043).

import { brl } from "@/lib/format";
import { CATEGORIAS } from "@/lib/types";
import type { RelatorioEstoque, RelatorioVendas } from "@/lib/ipc";

const PERIODO_ROTULO: Record<string, string> = {
  dia: "Dia Inteiro",
  manha: "Turma da Manhã",
  tarde: "Turma da Tarde",
};

export function VendasView({ rel }: { rel: RelatorioVendas }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        Relatório de Vendas — {PERIODO_ROTULO[rel.periodo] ?? rel.periodo} — {rel.data}
      </h2>

      {rel.pedidos.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma venda no período.</p>
      ) : (
        rel.pedidos.map((p) => (
          <div key={p.numero} className="rounded-lg border p-3 text-sm">
            <div className="font-medium">
              Pedido Nº {p.numero} · {p.cliente}
            </div>
            <ul className="text-muted-foreground mt-1">
              {p.itens.map((i, idx) => (
                <li key={idx} className="flex justify-between font-mono text-[12px]">
                  <span>
                    {i.qtd}× {i.titulo}
                  </span>
                  <span>{brl(i.valorCentavos)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 font-mono text-[12px] text-[#1f7a4d]">
              {p.cartao > 0 && <span>Cartão {brl(p.cartao)}</span>}
              {p.pix > 0 && <span>PIX {brl(p.pix)}</span>}
              {p.dinheiro > 0 && <span>Dinheiro {brl(p.dinheiro)}</span>}
              {p.ministerio > 0 && <span>Ministério {brl(p.ministerio)}</span>}
              {p.vale > 0 && <span>Vale {brl(p.vale)}</span>}
              <span className="ml-auto font-semibold">Total {brl(p.totalCentavos)}</span>
            </div>
          </div>
        ))
      )}

      <div className="bg-muted/40 rounded-lg p-4">
        <div className="mb-2 text-sm font-semibold">Resumo das Vendas</div>
        <div className="grid grid-cols-2 gap-1 font-mono text-sm">
          <Linha rotulo="Total Cartão" v={rel.resumo.cartao} />
          <Linha rotulo="Total PIX" v={rel.resumo.pix} />
          <Linha rotulo="Total Dinheiro" v={rel.resumo.dinheiro} />
          <Linha rotulo="Total Ministério" v={rel.resumo.ministerio} />
          <Linha rotulo="Total Vale Presente" v={rel.resumo.vale} />
        </div>
        <div className="mt-2 flex justify-between border-t pt-2 font-mono font-bold">
          <span>Sub Total (Dinheiro + Cartão + PIX)</span>
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
