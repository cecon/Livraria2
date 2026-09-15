"use client";

import { shiftsRequest } from "@/lib/api/turnos-client";

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
  return shiftsRequest("/aberto");
}

// Abre um turno. Falha se já houver um aberto do operador nesta origem (D7).
export async function abrirTurno(caixaInicialCentavos = 0): Promise<{ error?: string; turno?: TurnoAberto }> {
  try {
    const turno = await shiftsRequest("", "POST", {
      sync_uid: crypto.randomUUID(), caixa_inicial_centavos: caixaInicialCentavos,
    }) as TurnoAberto;
    return { turno };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao abrir turno" };
  }
}

// Quantidade de pedidos (não cancelados) já registrados no turno — base do Pedido Nº.
export async function contarPedidosDoTurno(turnoUid: string): Promise<number> {
  return shiftsRequest(`/${turnoUid}/pedidos/contagem`);
}

// Resumo de caixa ao vivo do turno (totais por forma + esperado só do dinheiro).
export async function resumoDoTurno(turnoUid: string, caixaInicialCentavos: number): Promise<ResumoTurno> {
  void caixaInicialCentavos;
  return shiftsRequest(`/${turnoUid}/resumo`);
}

// Encerra o turno com a conferência do dinheiro (fechamento de caixa).
export async function encerrarTurno(
  turnoUid: string,
  caixaInicialCentavos: number,
  conferidoDinheiroCentavos: number,
): Promise<{ error?: string; diferencaCentavos?: number }> {
  void caixaInicialCentavos;
  try {
    return await shiftsRequest(`/${turnoUid}/encerramento`, "POST", {
      conferido_centavos: conferidoDinheiroCentavos,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao encerrar turno" };
  }
}

// Histórico de turnos do operador (mais recentes primeiro).
export async function listarTurnos(): Promise<TurnoHistorico[]> {
  return shiftsRequest("");
}
