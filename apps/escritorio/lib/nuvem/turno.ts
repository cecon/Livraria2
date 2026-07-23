// Turno de operação na nuvem (feature 009, ADR-0021). Abrir/encerrar/consultar,
// com o fechamento de caixa calculado pelo domínio via WASM (mesma regra do PDV).
// Operador = usuário REAL logado (app_user), não a sessão de serviço (#15).
"use client";

import { createClient } from "@/utils/supabase/client";
import { dominio } from "@/lib/dominio";
import { operadorAtual } from "@/lib/nuvem/operador";
import { listarFormas } from "@/lib/nuvem/forma";

const ORIGEM = "escritorio";

export type TurnoAberto = {
  sync_uid: string;
  caixaInicialCentavos: number;
  abertura: string;
};

export type FormaTotal = { rotulo: string; centavos: number };

export type ResumoTurno = {
  qtdVendas: number;
  porForma: FormaTotal[];
  esperadoDinheiroCentavos: number;
};

export type TurnoHistorico = {
  sync_uid: string;
  abertura: string;
  encerramento: string | null;
  status: string;
  esperadoCentavos: number | null;
  conferidoCentavos: number | null;
  diferencaCentavos: number | null;
};

// Turno aberto do operador logado nesta origem (ou null).
export async function turnoAberto(): Promise<TurnoAberto | null> {
  const sb = createClient();
  const op = await operadorAtual();
  const { data } = await sb
    .from("turno_operacao")
    .select("sync_uid,caixa_inicial_centavos,abertura")
    .eq("operador_uid", op.uid)
    .eq("origem", ORIGEM)
    .eq("status", "aberto")
    .is("excluido_em", null)
    .order("abertura", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    sync_uid: data.sync_uid,
    caixaInicialCentavos: Number(data.caixa_inicial_centavos),
    abertura: data.abertura,
  };
}

// Abre um turno. Falha se já houver um aberto do operador nesta origem (D7).
export async function abrirTurno(caixaInicialCentavos = 0): Promise<{ error?: string; turno?: TurnoAberto }> {
  const jaAberto = await turnoAberto();
  if (jaAberto) {
    return { error: "Já existe um turno aberto. Encerre-o antes de abrir outro." };
  }
  const sb = createClient();
  const op = await operadorAtual();
  const agora = new Date().toISOString();
  const uid = crypto.randomUUID();
  const { error } = await sb.from("turno_operacao").insert({
    sync_uid: uid,
    operador_uid: op.uid,
    caixa_inicial_centavos: caixaInicialCentavos,
    status: "aberto",
    abertura: agora,
    origem: ORIGEM,
    atualizado_em: agora,
    criado_por: op.uid,
  });
  if (error) return { error: error.message };
  return { turno: { sync_uid: uid, caixaInicialCentavos, abertura: agora } };
}

// Quantidade de pedidos (não cancelados) já registrados no turno — base do Pedido Nº.
export async function contarPedidosDoTurno(turnoUid: string): Promise<number> {
  const sb = createClient();
  const { count } = await sb
    .from("pedido")
    .select("sync_uid", { count: "exact", head: true })
    .eq("turno_uid", turnoUid)
    .eq("cancelado", false)
    .is("excluido_em", null);
  return count ?? 0;
}

// Resumo de caixa ao vivo do turno (totais por forma + esperado só do dinheiro).
export async function resumoDoTurno(turnoUid: string, caixaInicialCentavos: number): Promise<ResumoTurno> {
  const sb = createClient();
  const dom = await dominio();

  // Pedidos válidos do turno.
  const { data: peds } = await sb
    .from("pedido")
    .select("sync_uid")
    .eq("turno_uid", turnoUid)
    .eq("cancelado", false)
    .is("excluido_em", null);
  const uids = ((peds as { sync_uid: string }[]) ?? []).map((p) => p.sync_uid);
  if (uids.length === 0) {
    return { qtdVendas: 0, porForma: [], esperadoDinheiroCentavos: caixaInicialCentavos };
  }

  // Recebimentos desses pedidos + mapa de formas (uuid → id numérico para o WASM).
  const [{ data: pags }, formas] = await Promise.all([
    sb.from("pagamento_pedido").select("forma_uid,valor_centavos").in("pedido_uid", uids).is("excluido_em", null),
    listarFormas(),
  ]);
  const idPorUid = new Map<string, number>();
  const rotuloPorId = new Map<number, string>();
  let dinheiroId = -1;
  formas.forEach((f, i) => {
    const id = i + 1;
    idPorUid.set(f.sync_uid, id);
    rotuloPorId.set(id, f.rotulo);
    if (f.chave === "dinheiro") dinheiroId = id;
  });

  const pagamentos = ((pags as { forma_uid: string; valor_centavos: number }[]) ?? [])
    .map((p) => ({ formaId: idPorUid.get(p.forma_uid) ?? 0, valorCentavos: Number(p.valor_centavos) }))
    .filter((p) => p.formaId > 0);

  const resumo = dom.turno_resumir_fechamento(pagamentos, caixaInicialCentavos, dinheiroId, uids.length) as {
    qtdVendas: number;
    porForma: { formaId: number; centavos: number }[];
    esperadoDinheiroCentavos: number;
  };
  return {
    qtdVendas: resumo.qtdVendas,
    porForma: resumo.porForma.map((pf) => ({ rotulo: rotuloPorId.get(pf.formaId) ?? "—", centavos: pf.centavos })),
    esperadoDinheiroCentavos: resumo.esperadoDinheiroCentavos,
  };
}

// Encerra o turno com a conferência do dinheiro (fechamento de caixa).
export async function encerrarTurno(
  turnoUid: string,
  caixaInicialCentavos: number,
  conferidoDinheiroCentavos: number,
): Promise<{ error?: string; diferencaCentavos?: number }> {
  const sb = createClient();
  const dom = await dominio();
  const resumo = await resumoDoTurno(turnoUid, caixaInicialCentavos);
  const fech = dom.turno_encerrar(resumo.esperadoDinheiroCentavos, conferidoDinheiroCentavos) as {
    esperadoCentavos: number;
    conferidoCentavos: number;
    diferencaCentavos: number;
  };
  const agora = new Date().toISOString();
  const { error } = await sb
    .from("turno_operacao")
    .update({
      status: "encerrado",
      encerramento: agora,
      esperado_centavos: fech.esperadoCentavos,
      conferido_centavos: fech.conferidoCentavos,
      diferenca_centavos: fech.diferencaCentavos,
      atualizado_em: agora,
    })
    .eq("sync_uid", turnoUid);
  if (error) return { error: error.message };
  return { diferencaCentavos: fech.diferencaCentavos };
}

// Histórico de turnos do operador (mais recentes primeiro).
export async function listarTurnos(): Promise<TurnoHistorico[]> {
  const sb = createClient();
  const op = await operadorAtual();
  const { data } = await sb
    .from("turno_operacao")
    .select("sync_uid,abertura,encerramento,status,esperado_centavos,conferido_centavos,diferenca_centavos")
    .eq("operador_uid", op.uid)
    .eq("origem", ORIGEM)
    .is("excluido_em", null)
    .order("abertura", { ascending: false })
    .limit(50);
  return ((data as Record<string, unknown>[]) ?? []).map((t) => ({
    sync_uid: t.sync_uid as string,
    abertura: t.abertura as string,
    encerramento: (t.encerramento as string) ?? null,
    status: t.status as string,
    esperadoCentavos: t.esperado_centavos == null ? null : Number(t.esperado_centavos),
    conferidoCentavos: t.conferido_centavos == null ? null : Number(t.conferido_centavos),
    diferencaCentavos: t.diferenca_centavos == null ? null : Number(t.diferenca_centavos),
  }));
}
