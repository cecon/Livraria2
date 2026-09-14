// Camada de dados de estoque (US2). Saldo pela view; movimentos crus para o
// fold de custo médio do domínio (WASM) — mesma regra do PDV (ADR-0009/0016).
import { createClient } from "@/utils/supabase/client";
import {
  payloadStatusDivergencia,
  type StatusDivergenciaEstoque,
  type TipoDivergenciaEstoque,
} from "./estoque_status";
export {
  payloadStatusDivergencia,
  type EstoqueStatusPedido,
  type StatusDivergenciaEstoque,
  type TipoDivergenciaEstoque,
} from "./estoque_status";

export type DivergenciaEstoque = {
  sync_uid: string;
  pedido_uid: string | null;
  item_pedido_uid: string | null;
  livro_uid: string | null;
  tipo: TipoDivergenciaEstoque;
  descricao: string;
  saldo_antes: number | null;
  qtd_evento: number | null;
  status: StatusDivergenciaEstoque;
  criado_em: string;
  resolvida_em: string | null;
  resolvida_por: string | null;
};

export type ProdutoPdvPublicado = {
  livro_uid: string;
  codigo: string;
  titulo: string;
  autor: string | null;
  preco_centavos: number;
  ativo: boolean;
  saldo_publicado: number;
};

export async function listarSaldos(): Promise<Map<string, number>> {
  const sb = createClient();
  const { data } = await sb.from("vw_saldo_livro").select("livro_uid,saldo");
  const m = new Map<string, number>();
  for (const r of (data as { livro_uid: string; saldo: number }[]) ?? []) {
    m.set(r.livro_uid, Number(r.saldo));
  }
  return m;
}

export async function listarDivergenciasEstoque(): Promise<DivergenciaEstoque[]> {
  const sb = createClient();
  const { data } = await sb
    .from("divergencia_estoque")
    .select(
      "sync_uid,pedido_uid,item_pedido_uid,livro_uid,tipo,descricao,saldo_antes,qtd_evento,status,criado_em,resolvida_em,resolvida_por",
    )
    .eq("status", "aberta")
    .is("excluido_em", null)
    .order("criado_em", { ascending: false });

  return ((data as DivergenciaEstoque[]) ?? []).map((d) => ({
    ...d,
    saldo_antes: d.saldo_antes == null ? null : Number(d.saldo_antes),
    qtd_evento: d.qtd_evento == null ? null : Number(d.qtd_evento),
  }));
}

async function atualizarStatusDivergencia(
  syncUid: string,
  status: Exclude<StatusDivergenciaEstoque, "aberta">,
): Promise<{ error?: string }> {
  const sb = createClient();
  const { data: sessao } = await sb.auth.getUser();
  const atualizadoEm = new Date().toISOString();
  const { error } = await sb
    .from("divergencia_estoque")
    .update(payloadStatusDivergencia(status, sessao.user?.id ?? null, atualizadoEm))
    .eq("sync_uid", syncUid)
    .eq("status", "aberta");
  return error ? { error: error.message } : {};
}

export async function resolverDivergenciaEstoque(syncUid: string): Promise<{ error?: string }> {
  return atualizarStatusDivergencia(syncUid, "resolvida");
}

export async function ignorarDivergenciaEstoque(syncUid: string): Promise<{ error?: string }> {
  return atualizarStatusDivergencia(syncUid, "ignorada");
}

// Movimentos ordenados por criado_em, no formato do fold: [qtd, custo_unit|null].
export type MovLedger = [number, number | null];

export async function movimentosDoLivro(livroUid: string): Promise<MovLedger[]> {
  const sb = createClient();
  const { data } = await sb
    .from("movimento_estoque")
    .select("qtd,custo_unit_centavos,criado_em")
    .eq("livro_uid", livroUid)
    .is("excluido_em", null)
    .order("criado_em");
  return ((data as { qtd: number; custo_unit_centavos: number | null }[]) ?? []).map(
    (r) => [Number(r.qtd), r.custo_unit_centavos == null ? null : Number(r.custo_unit_centavos)] as MovLedger,
  );
}
