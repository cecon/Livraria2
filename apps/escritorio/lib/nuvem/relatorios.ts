// Camada de dados de relatórios (US2/T031) — agrega no cliente (PostgREST não soma).
import { createClient } from "@/utils/supabase/client";

export type Linha = { rotulo: string; total: number };

type Item = { valor_centavos: number } & Record<string, unknown>;
type Ref = { sync_uid: string } & Record<string, unknown>;

function agrupar(itens: Item[], chaveUid: string, refs: Ref[], rotuloCampo: string): Linha[] {
  const nomes = new Map(refs.map((r) => [r.sync_uid, String(r[rotuloCampo] ?? "—")]));
  const soma = new Map<string, number>();
  for (const it of itens) {
    const uid = String(it[chaveUid] ?? "");
    soma.set(uid, (soma.get(uid) ?? 0) + (Number(it.valor_centavos) || 0));
  }
  return [...soma.entries()]
    .map(([uid, total]) => ({ rotulo: nomes.get(uid) ?? "—", total }))
    .sort((a, b) => b.total - a.total);
}

export async function relatorios(): Promise<{ pagamentos: Linha[]; destinacoes: Linha[] }> {
  const sb = createClient();
  const [pp, fp, av, de] = await Promise.all([
    sb.from("pagamento_pedido").select("forma_uid,valor_centavos"),
    sb.from("forma_pagamento").select("sync_uid,rotulo"),
    sb.from("alocacao_venda").select("destinacao_uid,valor_centavos"),
    sb.from("destinacao").select("sync_uid,nome"),
  ]);
  return {
    pagamentos: agrupar((pp.data as Item[]) ?? [], "forma_uid", (fp.data as Ref[]) ?? [], "rotulo"),
    destinacoes: agrupar((av.data as Item[]) ?? [], "destinacao_uid", (de.data as Ref[]) ?? [], "nome"),
  };
}
