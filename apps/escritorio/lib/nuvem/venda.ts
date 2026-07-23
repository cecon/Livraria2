// Venda (checkout) na nuvem (feature 009, US2). Exige turno aberto; usa as MESMAS
// regras do PDV via WASM (validar_conclusao, clamp de baixa, troco). Grava
// pedido → item_pedido → pagamento_pedido → movimento_estoque (saída).
//
// NOTA de escopo: a alocação de destinação de livros doados (alocacao_venda,
// features 006/014) fica como refinamento — não integra os critérios de aceite da
// US2 (estoque/custo/troco). A venda comum grava corretamente sem ela.
"use client";

import { createClient } from "@/utils/supabase/client";
import { dominio } from "@/lib/dominio";
import { operadorAtual } from "@/lib/nuvem/operador";
import { listarFormas } from "@/lib/nuvem/forma";
import { contarPedidosDoTurno } from "@/lib/nuvem/turno";

export type ItemVenda = { livroUid: string; codigo: string; titulo: string; precoCentavos: number; qtd: number };
export type RecebimentoVenda = { formaUid: string; valorCentavos: number };

export type VendaInput = {
  turnoUid: string;
  cliente?: string;
  itens: ItemVenda[];
  pagamentos: RecebimentoVenda[];
};

export type BaixaParcial = { codigo: string; titulo: string; pedido: number; baixado: number };

export type VendaResultado = {
  numeroNoTurno: number;
  totalCentavos: number;
  trocoCentavos: number;
  parciais: BaixaParcial[];
};

const ORIGEM = "escritorio";

// Turno derivado do horário (Manhã/Tarde) — mesma convenção do PDV (corte 13h).
function turnoPorHora(): string {
  return new Date().getHours() < 13 ? "manha" : "tarde";
}

export async function registrarVenda(input: VendaInput): Promise<{ error?: string; resultado?: VendaResultado }> {
  const sb = createClient();
  const dom = await dominio();

  if (input.itens.length === 0) return { error: "Adicione ao menos um item." };

  // Mapa de formas: uuid → id numérico (fronteira WASM) + id do Dinheiro.
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

  // Validação de conclusão (mesma regra do PDV, via WASM).
  const val = dom.validar_conclusao_venda(itensWasm, pagsWasm, dinheiroId) as {
    ok: boolean;
    erro?: string;
    faltaCentavos?: number;
  };
  if (!val.ok) return { error: mensagemErro(val) };

  // Numeração: Pedido Nº por turno + número global contínuo.
  const numeroNoTurno = Number(dom.turno_proximo_numero(await contarPedidosDoTurno(input.turnoUid)));
  const numeroGlobal = await proximoNumeroGlobal(sb);

  // Saldos correntes (derivados) para o clamp de baixa.
  const saldos = await saldosDos(sb, input.itens.map((i) => i.livroUid));

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
    origem: ORIGEM,
    atualizado_em: agora,
    criado_por: op.uid,
  });
  if (ePedido) return { error: ePedido.message };

  // Itens + movimentos de saída (baixa limitada ao saldo — clamp do domínio).
  const parciais: BaixaParcial[] = [];
  for (const it of input.itens) {
    await sb.from("item_pedido").insert({
      sync_uid: crypto.randomUUID(),
      pedido_uid: pedidoUid,
      codigo: it.codigo,
      titulo: it.titulo,
      preco_centavos: it.precoCentavos,
      qtd: it.qtd,
      origem: ORIGEM,
      atualizado_em: agora,
      criado_por: op.uid,
    });
    const saldo = saldos.get(it.livroUid) ?? 0;
    const baixa = Number(dom.clamp_baixa_venda(it.qtd, saldo));
    if (baixa < it.qtd) parciais.push({ codigo: it.codigo, titulo: it.titulo, pedido: it.qtd, baixado: baixa });
    if (baixa > 0) {
      await sb.from("movimento_estoque").insert({
        sync_uid: crypto.randomUUID(),
        livro_uid: it.livroUid,
        tipo: "saida_venda",
        qtd: -baixa,
        referencia: String(numeroGlobal),
        criado_em: agora,
        origem: ORIGEM,
        atualizado_em: agora,
        criado_por: op.uid,
      });
    }
  }

  // Recebimentos por forma.
  for (const p of input.pagamentos.filter((r) => r.valorCentavos > 0)) {
    await sb.from("pagamento_pedido").insert({
      sync_uid: crypto.randomUUID(),
      pedido_uid: pedidoUid,
      forma_uid: p.formaUid,
      valor_centavos: p.valorCentavos,
      origem: ORIGEM,
      atualizado_em: agora,
      criado_por: op.uid,
    });
  }

  const trocoCentavos = Number(dom.troco_venda(itensWasm, pagsWasm));
  return { resultado: { numeroNoTurno, totalCentavos, trocoCentavos, parciais } };
}

function mensagemErro(v: { erro?: string; faltaCentavos?: number }): string {
  switch (v.erro) {
    case "SEM_ITENS":
      return "Adicione ao menos um item.";
    case "PAGO_INSUFICIENTE":
      return "Pagamento insuficiente para concluir a venda.";
    case "TROCO_SEM_DINHEIRO":
      return "O troco só pode sair do Dinheiro.";
    default:
      return "Não foi possível concluir a venda.";
  }
}

async function proximoNumeroGlobal(sb: ReturnType<typeof createClient>): Promise<number> {
  const { data } = await sb.from("pedido").select("numero").order("numero", { ascending: false }).limit(1).maybeSingle();
  return (data?.numero ? Number(data.numero) : 0) + 1;
}

async function saldosDos(sb: ReturnType<typeof createClient>, livroUids: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (livroUids.length === 0) return m;
  const { data } = await sb.from("vw_saldo_livro").select("livro_uid,saldo").in("livro_uid", livroUids);
  for (const r of (data as { livro_uid: string; saldo: number }[]) ?? []) m.set(r.livro_uid, Number(r.saldo));
  return m;
}

// Vendas do dia (paridade com a aba "Lista de vendas" do PDV).
export type VendaResumo = { sync_uid: string; numeroNoTurno: number | null; numero: number; cliente: string; totalCentavos: number; cancelado: boolean };

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
