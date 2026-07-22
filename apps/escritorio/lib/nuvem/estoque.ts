// Camada de dados de estoque (US2). Saldo pela view; movimentos crus para o
// fold de custo médio do domínio (WASM) — mesma regra do PDV (ADR-0009/0016).
import { createClient } from "@/utils/supabase/client";

export async function listarSaldos(): Promise<Map<string, number>> {
  const sb = createClient();
  const { data } = await sb.from("vw_saldo_livro").select("livro_uid,saldo");
  const m = new Map<string, number>();
  for (const r of (data as { livro_uid: string; saldo: number }[]) ?? []) {
    m.set(r.livro_uid, Number(r.saldo));
  }
  return m;
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
