// Camada de dados de estoque (US2). Saldo pela view; movimentos crus para o
// fold de custo médio do domínio (WASM) — mesma regra do PDV (ADR-0009/0016).
import { stockRequest } from "@/lib/api/estoque-client";

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

// Movimentos ordenados por criado_em, no formato do fold: [qtd, custo_unit|null].
export type MovLedger = [number, number | null];

export async function movimentosDoLivro(livroUid: string): Promise<MovLedger[]> {
  const rows = await stockRequest(`/livros/${livroUid}/movimentos`) as
    { qtd: number; custo_unit_centavos: number | null }[];
  return rows.map(row => [row.qtd, row.custo_unit_centavos]);
}
