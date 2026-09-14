// Visão central dos turnos (feature 013, US6 — FR-018/FR-019).
//
// O escritório enxerga TODOS os turnos, de qualquer PDV: quem abriu, em qual
// máquina, quando, quantas vendas e quanto entrou. E pode encerrar um turno
// esquecido — o fechamento desce pelo sync e o PDV o aplica (FR-024).
"use client";

import { createClient } from "@/utils/supabase/client";

export type TurnoLinha = {
  syncUid: string;
  maquina: string | null;
  operador: string | null;
  status: string;
  abertura: string;
  encerramento: string | null;
  qtdVendas: number;
  totalCentavos: number;
  diferencaCentavos: number | null;
};

export type FiltroTurnos = {
  /** yyyy-mm-dd — abertura a partir de (inclusive). */
  de?: string;
  /** yyyy-mm-dd — abertura até (inclusive). */
  ate?: string;
  /** "aberto" | "encerrado" | "" (todos). */
  status?: string;
  /** Nome do PC; vazio = todos. */
  maquina?: string;
};

/** O turno padrão do backfill (FR-014) não é sessão de caixa — some da visão. */
const TURNO_PADRAO = "00000000-0013-0000-0000-000000000001";

export async function listarTurnos(filtro: FiltroTurnos = {}): Promise<TurnoLinha[]> {
  const sb = createClient();
  let q = sb
    .from("turno_operacao")
    .select(
      "sync_uid,maquina,status,abertura,encerramento,diferenca_centavos,operador_uid,usuario:operador_uid(usuario,nome)",
    )
    .is("excluido_em", null)
    .neq("sync_uid", TURNO_PADRAO)
    .order("abertura", { ascending: false })
    .limit(300);

  if (filtro.de) q = q.gte("abertura", filtro.de);
  if (filtro.ate) q = q.lte("abertura", `${filtro.ate}T23:59:59`);
  if (filtro.status) q = q.eq("status", filtro.status);
  if (filtro.maquina) q = q.eq("maquina", filtro.maquina);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const turnos = data ?? [];
  if (turnos.length === 0) return [];

  // Totais por turno numa consulta só (evita N+1 na lista).
  const uids = turnos.map((t) => t.sync_uid as string);
  const { data: vendas } = await sb
    .from("pedido")
    .select("turno_uid,total_centavos")
    .in("turno_uid", uids)
    .eq("cancelado", false)
    .is("excluido_em", null);

  const agregado = new Map<string, { qtd: number; total: number }>();
  for (const v of vendas ?? []) {
    const uid = v.turno_uid as string;
    const atual = agregado.get(uid) ?? { qtd: 0, total: 0 };
    atual.qtd += 1;
    atual.total += Number(v.total_centavos ?? 0);
    agregado.set(uid, atual);
  }

  return turnos.map((t) => {
    const somas = agregado.get(t.sync_uid as string) ?? { qtd: 0, total: 0 };
    const u = t.usuario as { usuario?: string; nome?: string } | null;
    return {
      syncUid: t.sync_uid as string,
      maquina: (t.maquina as string | null) ?? null,
      operador: u?.nome ?? u?.usuario ?? null,
      status: t.status as string,
      abertura: t.abertura as string,
      encerramento: (t.encerramento as string | null) ?? null,
      qtdVendas: somas.qtd,
      totalCentavos: somas.total,
      diferencaCentavos:
        t.diferenca_centavos === null || t.diferenca_centavos === undefined
          ? null
          : Number(t.diferenca_centavos),
    };
  });
}

/** Máquinas que já abriram turno — alimenta o filtro. */
export async function listarMaquinas(): Promise<string[]> {
  const sb = createClient();
  const { data } = await sb
    .from("turno_operacao")
    .select("maquina")
    .not("maquina", "is", null)
    .is("excluido_em", null)
    .limit(1000);
  return [...new Set((data ?? []).map((t) => t.maquina as string))].sort();
}

/**
 * Encerra um turno pela nuvem (FR-019) — liberado a **qualquer** usuário do
 * escritório. Grava só `status` + `atualizado_em` (LWW): a conferência de caixa
 * é do PDV; aqui o ato é destravar um turno esquecido. O PDV aplica o
 * fechamento no próximo pull e migra o que ainda não subiu (FR-024).
 */
export async function encerrarTurnoPelaNuvem(syncUid: string): Promise<{ error?: string }> {
  const sb = createClient();
  const agora = new Date().toISOString();
  const { error } = await sb
    .from("turno_operacao")
    .update({ status: "encerrado", encerramento: agora, atualizado_em: agora })
    .eq("sync_uid", syncUid)
    .eq("status", "aberto");
  return error ? { error: error.message } : {};
}
