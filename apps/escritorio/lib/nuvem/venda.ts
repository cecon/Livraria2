"use client";

import { dominio } from "@/lib/dominio";
import { listarFormas } from "@/lib/nuvem/forma";
import { operadorAtual } from "@/lib/nuvem/operador";
import { contarPedidosDoTurno } from "@/lib/nuvem/turno";
import { createClient } from "@/utils/supabase/client";

export type ItemVenda = {
  livroUid: string;
  codigo: string;
  titulo: string;
  precoCentavos: number;
  qtd: number;
};

export type RecebimentoVenda = { formaUid: string; valorCentavos: number };

export type VendaInput = {
  turnoUid: string;
  cliente?: string;
  itens: ItemVenda[];
  pagamentos: RecebimentoVenda[];
};

export type VendaResultado = {
  numeroNoTurno: number;
  totalCentavos: number;
  trocoCentavos: number;
  divergenciasEstoque: number;
};

const ORIGEM = "escritorio";

function turnoPorHora(): string {
  return new Date().getHours() < 13 ? "manha" : "tarde";
}

export async function registrarVenda(input: VendaInput): Promise<{ error?: string; resultado?: VendaResultado }> {
  const sb = createClient();
  const dom = await dominio();

  if (input.itens.length === 0) return { error: "Adicione ao menos um item." };

  const formas = await listarFormas();
  const idPorUid = new Map<string, number>();
  let dinheiroId = -1;
  formas.forEach((f, i) => {
    idPorUid.set(f.sync_uid, i + 1);
    if (f.chave === "dinheiro") dinheiroId = i + 1;
  });

  const itensWasm = input.itens.map((i) => ({ precoCentavos: i.precoCentavos, qtd: i.qtd }));
  const pagsWasm = input.pagamentos
    .filter((p) => p.valorCentavos > 0)
    .map((p) => ({ formaId: idPorUid.get(p.formaUid) ?? 0, valorCentavos: p.valorCentavos }));

  const val = dom.validar_conclusao_venda(itensWasm, pagsWasm, dinheiroId) as {
    ok: boolean;
    erro?: string;
    faltaCentavos?: number;
  };
  if (!val.ok) return { error: mensagemErro(val) };

  const numeroNoTurno = Number(dom.turno_proximo_numero(await contarPedidosDoTurno(input.turnoUid)));
  const numeroGlobal = await proximoNumeroGlobal(sb);
  const op = await operadorAtual();
  const agora = new Date().toISOString();
  const pedidoUid = crypto.randomUUID();
  const totalCentavos = input.itens.reduce((s, i) => s + i.precoCentavos * i.qtd, 0);

  const { error: ePedido } = await sb.from("pedido").insert({
    sync_uid: pedidoUid,
    numero: numeroGlobal,
    numero_no_turno: numeroNoTurno,
    turno_uid: input.turnoUid,
    operador_uid: op.uid,
    cliente: (input.cliente ?? "").trim() || "CLIENTE",
    turno: turnoPorHora(),
    data: agora.slice(0, 10),
    total_centavos: totalCentavos,
    cancelado: false,
    estoque_status: "rascunho",
    origem: ORIGEM,
    atualizado_em: agora,
    criado_por: op.uid,
  });
  if (ePedido) return { error: ePedido.message };

  for (const it of input.itens) {
    const { error } = await sb.from("item_pedido").insert({
      sync_uid: crypto.randomUUID(),
      pedido_uid: pedidoUid,
      livro_uid: it.livroUid,
      codigo: it.codigo,
      titulo: it.titulo,
      preco_centavos: it.precoCentavos,
      qtd: it.qtd,
      origem: ORIGEM,
      atualizado_em: agora,
      criado_por: op.uid,
    });
    if (error) return { error: error.message };
  }

  for (const p of input.pagamentos.filter((r) => r.valorCentavos > 0)) {
    const { error } = await sb.from("pagamento_pedido").insert({
      sync_uid: crypto.randomUUID(),
      pedido_uid: pedidoUid,
      forma_uid: p.formaUid,
      valor_centavos: p.valorCentavos,
      origem: ORIGEM,
      atualizado_em: agora,
      criado_por: op.uid,
    });
    if (error) return { error: error.message };
  }

  const prontoEm = new Date().toISOString();
  const { error: ePronta } = await sb
    .from("pedido")
    .update({ estoque_status: "pronta", estoque_pronta_em: prontoEm, atualizado_em: prontoEm })
    .eq("sync_uid", pedidoUid);
  if (ePronta) return { error: ePronta.message };

  const trocoCentavos = Number(dom.troco_venda(itensWasm, pagsWasm));
  const divergenciasEstoque = await contarDivergenciasAbertas(sb, pedidoUid);
  return { resultado: { numeroNoTurno, totalCentavos, trocoCentavos, divergenciasEstoque } };
}

function mensagemErro(v: { erro?: string; faltaCentavos?: number }): string {
  switch (v.erro) {
    case "SEM_ITENS":
      return "Adicione ao menos um item.";
    case "PAGO_INSUFICIENTE":
      return "Pagamento insuficiente para concluir a venda.";
    case "TROCO_SEM_DINHEIRO":
      return "O troco so pode sair do Dinheiro.";
    default:
      return "Nao foi possivel concluir a venda.";
  }
}

async function proximoNumeroGlobal(sb: ReturnType<typeof createClient>): Promise<number> {
  const { data } = await sb.from("pedido").select("numero").order("numero", { ascending: false }).limit(1).maybeSingle();
  return (data?.numero ? Number(data.numero) : 0) + 1;
}

async function contarDivergenciasAbertas(sb: ReturnType<typeof createClient>, pedidoUid: string): Promise<number> {
  const { count } = await sb
    .from("divergencia_estoque")
    .select("sync_uid", { count: "exact", head: true })
    .eq("pedido_uid", pedidoUid)
    .eq("status", "aberta");
  return count ?? 0;
}

export type VendaResumo = {
  sync_uid: string;
  numeroNoTurno: number | null;
  numero: number;
  cliente: string;
  totalCentavos: number;
  cancelado: boolean;
};

export async function listarVendasDoDia(): Promise<VendaResumo[]> {
  const sb = createClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const { data } = await sb
    .from("pedido")
    .select("sync_uid,numero,numero_no_turno,cliente,total_centavos,cancelado")
    .eq("data", hoje)
    .is("excluido_em", null)
    .order("numero_no_turno", { ascending: false });

  return ((data as Record<string, unknown>[]) ?? []).map((p) => ({
    sync_uid: p.sync_uid as string,
    numeroNoTurno: p.numero_no_turno == null ? null : Number(p.numero_no_turno),
    numero: Number(p.numero),
    cliente: (p.cliente as string) ?? "CLIENTE",
    totalCentavos: Number(p.total_centavos),
    cancelado: Boolean(p.cancelado),
  }));
}
