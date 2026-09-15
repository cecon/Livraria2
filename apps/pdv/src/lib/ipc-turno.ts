// IPC do turno (feature 012, US5): vendas do turno aberto para a tela inicial.
// Módulo separado do `ipc.ts` para respeitar o limite de 300 linhas (Constituição III).

import { invoke } from "@tauri-apps/api/core";

export type VendaTurno = {
  numero: number;
  data: string;
  totalCentavos: number;
  cancelada: boolean;
};

export async function vendasDoTurno(turnoUid: string): Promise<VendaTurno[]> {
  return await invoke("vendas_do_turno", { turnoUid });
}
