// Camada de relatórios (US2/T031) — agrega no cliente (PostgREST não soma).
import { createClient } from "@/utils/supabase/client";

export type LinhaValor = { rotulo: string; valorCentavos: number };
export type ItemRel = { titulo: string; qtd: number; valorCentavos: number };

export type PedidoRel = {
  numero: number;
  cliente: string;
  cancelado: boolean;
  totalCentavos: number;
  itens: ItemRel[];
  recebimentos: LinhaValor[];
};
export type RepasseRel = { nome: string; qtd: number; valorCentavos: number; livros: ItemRel[] };
export type RelatorioVendas = {
  data: string;
  periodo: string;
  pedidos: PedidoRel[];
  repasses: RepasseRel[];
  resumo: { formas: LinhaValor[]; subtotalCentavos: number };
};

export type RelatorioEstoque = {
  titulos: number;
  valorTotalCentavos: number;
  itens: { codigo: string; titulo: string; categoria: number; precoCentavos: number; estoque: number; valorCentavos: number }[];
};

export type RelatorioDestinacoes = {
  inicio: string;
  fim: string;
  linhas: { nome: string; qtd: number; valorCentavos: number }[];
  totalCentavos: number;
};

const proxDia = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() + 1);
  return dt.toISOString().slice(0, 10);
};

export async function relatorioEstoque(): Promise<RelatorioEstoque> {
  const sb = createClient();
  const [saldoRes, livroRes] = await Promise.all([
    sb.from("vw_saldo_livro").select("livro_uid,codigo,saldo"),
    sb.from("livro").select("sync_uid,codigo,titulo,categoria,preco_centavos").is("excluido_em", null),
  ]);
  const saldos = new Map((saldoRes.data as { livro_uid: string; saldo: number }[] ?? []).map((r) => [r.livro_uid, Number(r.saldo)]));
  const itens = (livroRes.data as { sync_uid: string; codigo: string; titulo: string; categoria: number; preco_centavos: number }[] ?? [])
    .map((l) => {
      const estoque = saldos.get(l.sync_uid) ?? 0;
      return { codigo: l.codigo, titulo: l.titulo, categoria: l.categoria, precoCentavos: Number(l.preco_centavos), estoque, valorCentavos: estoque * Number(l.preco_centavos) };
    })
    .sort((a, b) => a.titulo.localeCompare(b.titulo));
  return { titulos: itens.length, valorTotalCentavos: itens.reduce((s, i) => s + i.valorCentavos, 0), itens };
}

export async function relatorioDestinacoes(inicio: string, fim: string): Promise<RelatorioDestinacoes> {
  const sb = createClient();
  const { data } = await sb
    .from("alocacao_venda")
    .select("qtd,valor_centavos,destinacao:destinacao_uid(nome),pedido!inner(data,cancelado)")
    .gte("pedido.data", inicio)
    .lt("pedido.data", proxDia(fim))
    .eq("pedido.cancelado", false);
  const acc = new Map<string, { qtd: number; valor: number }>();
  for (const a of (data as unknown as { qtd: number; valor_centavos: number; destinacao: { nome: string } | null }[]) ?? []) {
    const nome = a.destinacao?.nome ?? "—";
    const cur = acc.get(nome) ?? { qtd: 0, valor: 0 };
    acc.set(nome, { qtd: cur.qtd + Number(a.qtd), valor: cur.valor + Number(a.valor_centavos) });
  }
  const linhas = [...acc.entries()].map(([nome, v]) => ({ nome, qtd: v.qtd, valorCentavos: v.valor })).sort((a, b) => b.valorCentavos - a.valorCentavos);
  return { inicio, fim, linhas, totalCentavos: linhas.reduce((s, l) => s + l.valorCentavos, 0) };
}

export async function relatorioVendas(data: string, periodo: string): Promise<RelatorioVendas> {
  const sb = createClient();
  let q = sb.from("pedido").select("sync_uid,numero,cliente,cancelado,total_centavos,turno").is("excluido_em", null).gte("data", data).lt("data", proxDia(data));
  if (periodo === "manha") q = q.eq("turno", "manha");
  else if (periodo === "tarde") q = q.eq("turno", "tarde");
  const { data: peds } = await q.order("numero");
  const pedidos = (peds as { sync_uid: string; numero: number; cliente: string; cancelado: boolean; total_centavos: number }[]) ?? [];
  const uids = pedidos.map((p) => p.sync_uid);

  const [itRes, pgRes, fpRes] = uids.length
    ? await Promise.all([
        sb.from("item_pedido").select("pedido_uid,titulo,qtd,preco_centavos").in("pedido_uid", uids),
        sb.from("pagamento_pedido").select("pedido_uid,forma_uid,valor_centavos").in("pedido_uid", uids),
        sb.from("forma_pagamento").select("sync_uid,rotulo"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const formas = new Map((fpRes.data as { sync_uid: string; rotulo: string }[] ?? []).map((f) => [f.sync_uid, f.rotulo]));
  const porPedidoItens = new Map<string, ItemRel[]>();
  for (const i of (itRes.data as { pedido_uid: string; titulo: string; qtd: number; preco_centavos: number }[]) ?? []) {
    const arr = porPedidoItens.get(i.pedido_uid) ?? [];
    arr.push({ titulo: i.titulo, qtd: Number(i.qtd), valorCentavos: Number(i.qtd) * Number(i.preco_centavos) });
    porPedidoItens.set(i.pedido_uid, arr);
  }
  const porPedidoPag = new Map<string, LinhaValor[]>();
  const totalPorForma = new Map<string, number>();
  for (const p of (pgRes.data as { pedido_uid: string; forma_uid: string; valor_centavos: number }[]) ?? []) {
    const rot = formas.get(p.forma_uid) ?? "—";
    const arr = porPedidoPag.get(p.pedido_uid) ?? [];
    arr.push({ rotulo: rot, valorCentavos: Number(p.valor_centavos) });
    porPedidoPag.set(p.pedido_uid, arr);
    totalPorForma.set(rot, (totalPorForma.get(rot) ?? 0) + Number(p.valor_centavos));
  }

  const pedidosRel: PedidoRel[] = pedidos.map((p) => ({
    numero: p.numero,
    cliente: p.cliente,
    cancelado: p.cancelado,
    totalCentavos: Number(p.total_centavos),
    itens: porPedidoItens.get(p.sync_uid) ?? [],
    recebimentos: porPedidoPag.get(p.sync_uid) ?? [],
  }));

  const formasResumo = [...totalPorForma.entries()].map(([rotulo, totalCentavos]) => ({ rotulo, valorCentavos: totalCentavos }));
  return {
    data,
    periodo,
    pedidos: pedidosRel,
    repasses: [],
    resumo: { formas: formasResumo, subtotalCentavos: formasResumo.reduce((s, f) => s + f.valorCentavos, 0) },
  };
}
