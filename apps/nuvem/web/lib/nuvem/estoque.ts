// Camada de dados de estoque (US2). Saldo pela view; movimentos crus para o
// fold de custo médio do domínio (WASM) — mesma regra do PDV (ADR-0009/0016).
import { stockRequest } from "@/lib/api/estoque-client";
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
  const rows = await stockRequest("/saldos") as { livro_uid: string; saldo: number }[];
  return new Map(rows.map(row => [row.livro_uid, row.saldo]));
}

export async function listarDivergenciasEstoque(): Promise<DivergenciaEstoque[]> {
  return stockRequest("/divergencias");
}

async function atualizarStatusDivergencia(
  syncUid: string,
  status: Exclude<StatusDivergenciaEstoque, "aberta">,
): Promise<{ error?: string }> {
  try {
    await stockRequest(`/divergencias/${syncUid}`, "PUT", { status });
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao atualizar divergencia" };
  }
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
  const rows = await stockRequest(`/livros/${livroUid}/movimentos`) as
    { qtd: number; custo_unit_centavos: number | null }[];
  return rows.map(row => [row.qtd, row.custo_unit_centavos]);
}
