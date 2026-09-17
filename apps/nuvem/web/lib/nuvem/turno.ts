"use client";

import { shiftsRequest } from "@/lib/api/turnos-client";

export type TurnoPdv = {
  sync_uid: string;
  maquina: string;
  operador: string;
  status: string;
  abertura: string;
  encerramento: string | null;
  caixaInicialCentavos: string;
  esperadoCentavos: string | null;
  conferidoCentavos: string | null;
  diferencaCentavos: string | null;
  vendas: number;
  totalVendidoCentavos: string;
};

export async function listarTurnos(): Promise<TurnoPdv[]> {
  return shiftsRequest("");
}
