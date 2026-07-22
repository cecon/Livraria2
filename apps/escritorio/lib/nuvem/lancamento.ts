// Ciclo de nota de entrada na nuvem (US2/T027). Rascunho editável; ao dar
// entrada gera os movimentos; cancelar (finalizada) estorna. Eventos por sync_uid.
import { createClient } from "@/utils/supabase/client";

export type StatusNota = "rascunho" | "finalizada" | "cancelada";
export type NotaResumo = { sync_uid: string; fornecedorNome: string | null; data: string; status: StatusNota; qtdItens: number; totalCentavos: number };
export type ItemNota = { sync_uid: string; titulo: string; qtd: number; custoUnitCentavos: number; subtotalCentavos: number };
export type NotaDetalhe = { sync_uid: string; numero: string | null; status: StatusNota; fornecedorUid: string | null; fornecedorNome: string | null; itens: ItemNota[]; totalCentavos: number };

async function sessao() {
  const sb = createClient();
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

type LinhaResumo = {
  sync_uid: string;
  data: string;
  status: StatusNota;
  fornecedor: { nome: string } | null;
  itens: { qtd: number; custo_unit_centavos: number }[];
};

export async function lancamentosListar(): Promise<NotaResumo[]> {
  const sb = createClient();
  const { data } = await sb
    .from("lancamento_entrada")
    .select("sync_uid,data,status,fornecedor:fornecedor_uid(nome),itens:item_lancamento(qtd,custo_unit_centavos)")
    .is("excluido_em", null)
    .order("data", { ascending: false })
    .limit(200);
  return ((data as unknown as LinhaResumo[]) ?? []).map((l) => ({
    sync_uid: l.sync_uid,
    fornecedorNome: l.fornecedor?.nome ?? null,
    data: l.data,
    status: l.status,
    qtdItens: l.itens.length,
    totalCentavos: l.itens.reduce((s, i) => s + Number(i.qtd) * Number(i.custo_unit_centavos), 0),
  }));
}

export async function lancamentoCriar(): Promise<string> {
  const sb = createClient();
  const uid = crypto.randomUUID();
  const agora = new Date().toISOString();
  await sb.from("lancamento_entrada").insert({ sync_uid: uid, data: agora, status: "rascunho", origem: "escritorio", criado_por: await sessao(), atualizado_em: agora });
  return uid;
}

type LinhaDetalhe = {
  sync_uid: string;
  numero: string | null;
  status: StatusNota;
  fornecedor_uid: string | null;
  fornecedor: { nome: string } | null;
  itens: { sync_uid: string; qtd: number; custo_unit_centavos: number; livro: { titulo: string } | null }[];
};

export async function lancamentoObter(uid: string): Promise<NotaDetalhe | null> {
  const sb = createClient();
  const { data } = await sb
    .from("lancamento_entrada")
    .select("sync_uid,numero,status,fornecedor_uid,fornecedor:fornecedor_uid(nome),itens:item_lancamento(sync_uid,qtd,custo_unit_centavos,livro:livro_uid(titulo))")
    .eq("sync_uid", uid)
    .single();
  if (!data) return null;
  const l = data as unknown as LinhaDetalhe;
  const itens: ItemNota[] = l.itens.map((i) => ({
    sync_uid: i.sync_uid,
    titulo: i.livro?.titulo ?? "—",
    qtd: Number(i.qtd),
    custoUnitCentavos: Number(i.custo_unit_centavos),
    subtotalCentavos: Number(i.qtd) * Number(i.custo_unit_centavos),
  }));
  return {
    sync_uid: l.sync_uid,
    numero: l.numero,
    status: l.status,
    fornecedorUid: l.fornecedor_uid,
    fornecedorNome: l.fornecedor?.nome ?? null,
    itens,
    totalCentavos: itens.reduce((s, i) => s + i.subtotalCentavos, 0),
  };
}

export async function lancamentoDefinirFornecedor(uid: string, fornecedorUid: string | null, numero?: string | null): Promise<void> {
  const sb = createClient();
  await sb.from("lancamento_entrada").update({ fornecedor_uid: fornecedorUid, numero: numero ?? null, atualizado_em: new Date().toISOString() }).eq("sync_uid", uid);
}

export async function lancamentoAdicionarItem(uid: string, livroUid: string, qtd: number, custoUnitCentavos: number): Promise<void> {
  const sb = createClient();
  await sb.from("item_lancamento").insert({
    sync_uid: crypto.randomUUID(),
    lancamento_uid: uid,
    livro_uid: livroUid,
    qtd,
    custo_unit_centavos: custoUnitCentavos,
    origem: "escritorio",
    criado_por: await sessao(),
  });
}

export async function lancamentoRemoverItem(itemUid: string): Promise<void> {
  const sb = createClient();
  await sb.from("item_lancamento").update({ excluido_em: new Date().toISOString() }).eq("sync_uid", itemUid);
}

// Dar entrada: finaliza e gera um movimento `entrada` por item.
export async function lancamentoFinalizar(uid: string): Promise<{ error?: string }> {
  const sb = createClient();
  const nota = await lancamentoObter(uid);
  if (!nota) return { error: "Nota não encontrada." };
  if (nota.itens.length === 0) return { error: "Adicione itens antes de dar entrada." };
  const { data: itensRaw } = await sb.from("item_lancamento").select("livro_uid,qtd,custo_unit_centavos").eq("lancamento_uid", uid).is("excluido_em", null);
  const criadoPor = await sessao();
  const agora = new Date().toISOString();
  for (const it of (itensRaw as { livro_uid: string; qtd: number; custo_unit_centavos: number }[]) ?? []) {
    await sb.from("movimento_estoque").insert({
      sync_uid: crypto.randomUUID(),
      livro_uid: it.livro_uid,
      tipo: "entrada",
      qtd: Number(it.qtd),
      custo_unit_centavos: Number(it.custo_unit_centavos),
      criado_em: agora,
      origem: "escritorio",
      criado_por: criadoPor,
    });
  }
  const { error } = await sb.from("lancamento_entrada").update({ status: "finalizada", finalizada_em: agora, atualizado_em: agora }).eq("sync_uid", uid);
  return error ? { error: error.message } : {};
}

// Cancelar nota finalizada: estorna (ajuste negativo) e marca cancelada.
export async function lancamentoCancelar(uid: string): Promise<{ error?: string }> {
  const sb = createClient();
  const { data: itensRaw } = await sb.from("item_lancamento").select("livro_uid,qtd").eq("lancamento_uid", uid).is("excluido_em", null);
  const criadoPor = await sessao();
  const agora = new Date().toISOString();
  for (const it of (itensRaw as { livro_uid: string; qtd: number }[]) ?? []) {
    await sb.from("movimento_estoque").insert({
      sync_uid: crypto.randomUUID(),
      livro_uid: it.livro_uid,
      tipo: "ajuste",
      qtd: -Number(it.qtd),
      motivo: "estorno de lançamento",
      criado_em: agora,
      origem: "escritorio",
      criado_por: criadoPor,
    });
  }
  const { error } = await sb.from("lancamento_entrada").update({ status: "cancelada", atualizado_em: agora }).eq("sync_uid", uid);
  return error ? { error: error.message } : {};
}

export async function lancamentoExcluir(uid: string): Promise<void> {
  const sb = createClient();
  await sb.from("lancamento_entrada").update({ excluido_em: new Date().toISOString() }).eq("sync_uid", uid);
}
