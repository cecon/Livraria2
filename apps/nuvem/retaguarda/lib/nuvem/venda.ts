"use client";

import { salesRequest } from "@/lib/api/vendas-client";

export type VendaResumo = {
  sync_uid: string;
  numeroNoTurno: number | null;
  numero: number;
  cliente: string;
  totalCentavos: number;
  cancelado: boolean;
  maquina: string;
  operador: string;
  recebidoEm: string;
};

export async function listarVendasDoDia(): Promise<VendaResumo[]> {
  return salesRequest("/hoje");
}
