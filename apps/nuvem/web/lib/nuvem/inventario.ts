// Inventário na nuvem (feature 009, US3). A SESSÃO de contagem é client-side (D5);
// a reconciliação (parcial/total) usa o domínio via WASM — as MESMAS regras do PDV
// (ADR-0010). Só os ajustes vão para movimento_estoque (tipo `contagem`, como o PDV).
"use client";

import { createClient } from "@/utils/supabase/client";
import { dominio } from "@/lib/dominio";
import { stockApiEnabled, stockRequest } from "@/lib/api/estoque-client";
import { operadorAtual } from "@/lib/nuvem/operador";
import { listarLivros } from "@/lib/nuvem/livro";
import { listarSaldos } from "@/lib/nuvem/estoque";

export type ModoInventario = "parcial" | "total";

export type LivroContagem = { livroUid: string; codigo: string; titulo: string; saldo: number };

export type Divergencia = {
  livroUid: string;
  codigo: string;
  titulo: string;
  saldo: number;
  efetiva: number;
  diferenca: number;
};

// Livros com saldo corrente (derivado) para a contagem.
export async function livrosParaContagem(): Promise<LivroContagem[]> {
  const [livros, saldos] = await Promise.all([listarLivros(), listarSaldos()]);
  return livros.map((l) => ({ livroUid: l.sync_uid, codigo: l.codigo, titulo: l.titulo, saldo: saldos.get(l.sync_uid) ?? 0 }));
}

// Reconcilia a contagem contra o saldo (via WASM). Parcial: só os contados; Total:
// todos (não-contados contam 0). Retorna as divergências para revisão.
export async function reconciliar(
  modo: ModoInventario,
  contados: Map<string, number>,
  livros: LivroContagem[],
): Promise<Divergencia[]> {
  const dom = await dominio();
  const alvo = modo === "total" ? livros : livros.filter((l) => contados.has(l.livroUid));
  const divergencias: Divergencia[] = [];
  for (const l of alvo) {
    const tem = contados.has(l.livroUid);
    const contada = contados.get(l.livroUid) ?? 0;
    const efetiva = dom.contagem_efetiva(modo, contada, tem) as number | null;
    if (efetiva === null) continue; // parcial não-contado: intacto
    const diferenca = Number(dom.diferenca_contagem(l.saldo, efetiva));
    divergencias.push({ livroUid: l.livroUid, codigo: l.codigo, titulo: l.titulo, saldo: l.saldo, efetiva, diferenca });
  }
  return divergencias;
}

// Aplica os ajustes: um movimento `contagem` por divergência ≠ 0 (qtd = diferença).
export async function aplicarContagem(divergencias: Divergencia[]): Promise<{ error?: string; ajustes?: number }> {
  const aplicar = divergencias.filter((d) => d.diferenca !== 0);
  try {
    if (await stockApiEnabled()) {
      const result = await stockRequest("/contagens", "POST", { itens: aplicar.map(d => ({
        sync_uid: crypto.randomUUID(), livro_uid: d.livroUid, qtd: d.diferenca,
      })) }) as { ajustes: number };
      return { ajustes: result.ajustes };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao aplicar contagem" };
  }
  const sb = createClient();
  const op = await operadorAtual();
  const agora = new Date().toISOString();
  for (const d of aplicar) {
    const { error } = await sb.from("movimento_estoque").insert({
      sync_uid: crypto.randomUUID(),
      livro_uid: d.livroUid,
      tipo: "contagem",
      qtd: d.diferenca,
      referencia: "inventario",
      criado_em: agora,
      origem: "escritorio",
      atualizado_em: agora,
      criado_por: op.uid,
    });
    if (error) return { error: error.message };
  }
  return { ajustes: aplicar.length };
}
