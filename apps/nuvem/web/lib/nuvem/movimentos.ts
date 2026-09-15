// Movimentos de um livro (US2) — extrato com saldo acumulado e ajuste avulso.
import { createClient } from "@/utils/supabase/client";
import { stockApiEnabled, stockRequest } from "@/lib/api/estoque-client";

export const ROTULO_MOVIMENTO: Record<string, string> = {
  saldo_inicial: "Saldo inicial",
  entrada: "Entrada",
  saida_venda: "Venda pronta",
  estorno_venda: "Estorno de venda",
  ajuste: "Ajuste",
  contagem: "Inventário",
};

export type Movimento = {
  sync_uid: string;
  tipo: string;
  qtd: number;
  custo_unit_centavos: number | null;
  fornecedor: string | null;
  motivo: string | null;
  referencia: string | null;
  criado_em: string;
  saldoResultante: number;
};

export async function extratoLivro(livroUid: string, limite = 50): Promise<Movimento[]> {
  if (await stockApiEnabled()) {
    const rows = await stockRequest(`/livros/${livroUid}/movimentos`) as Omit<Movimento, "saldoResultante">[];
    return prepararExtrato(rows, limite);
  }
  const sb = createClient();
  const { data } = await sb
    .from("movimento_estoque")
    .select("sync_uid,tipo,qtd,custo_unit_centavos,fornecedor,motivo,referencia,criado_em")
    .eq("livro_uid", livroUid)
    .is("excluido_em", null)
    .order("criado_em");
  return prepararExtrato((data as Omit<Movimento, "saldoResultante">[]) ?? [], limite);
}

function prepararExtrato(linhas: Omit<Movimento, "saldoResultante">[], limite: number) {
  // Saldo acumulado (fold por ordem de criação), como o PDV.
  let saldo = 0;
  const comSaldo = linhas.map((m) => {
    saldo += Number(m.qtd);
    return { ...m, qtd: Number(m.qtd), saldoResultante: saldo };
  });
  // Exibe do mais recente para o mais antigo, limitado.
  return comSaldo.reverse().slice(0, limite);
}

export async function registrarAjuste(livroUid: string, delta: number, motivo: string): Promise<{ error?: string }> {
  try {
    if (await stockApiEnabled()) {
      await stockRequest("/ajustes", "POST", {
        sync_uid: crypto.randomUUID(), livro_uid: livroUid, qtd: delta, motivo,
      });
      return {};
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao registrar ajuste" };
  }
  const sb = createClient();
  const { data: sessao } = await sb.auth.getUser();
  const { error } = await sb.from("movimento_estoque").insert({
    sync_uid: crypto.randomUUID(),
    livro_uid: livroUid,
    tipo: "ajuste",
    qtd: delta,
    motivo: motivo.trim(),
    criado_em: new Date().toISOString(),
    origem: "escritorio",
    criado_por: sessao.user?.id ?? null,
  });
  return error ? { error: error.message } : {};
}
