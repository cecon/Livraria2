// IPC do turno (feature 013, FR-022): as vendas do turno aberto para a tela
// inicial, no MESMO formato do relatório — a tela reusa o cartão de venda.
// Módulo separado do `ipc.ts` para respeitar o limite de 300 linhas (Constituição III).

import { invoke } from "@tauri-apps/api/core";
import type { PedidoRelatorio } from "./ipc";

export type VendaTurno = PedidoRelatorio;

export async function vendasDoTurno(turnoUid: string): Promise<VendaTurno[]> {
  return await invoke("vendas_do_turno", { turnoUid });
}
