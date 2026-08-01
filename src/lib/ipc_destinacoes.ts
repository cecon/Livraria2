// IPC das destinações (feature 006 — ADR-0014): relatório de repasse por
// destinação (o cadastro e a operação de destinar vivem na nuvem — feature 012).

import { invoke } from "@tauri-apps/api/core";
import type { RelatorioDestinacoes } from "./types";

/** Datas ISO inclusivas; posição atual vem junto (independe do período). */
export async function relatorioDestinacoes(
  inicio: string,
  fim: string,
): Promise<RelatorioDestinacoes> {
  return await invoke("relatorio_destinacoes", { inicio, fim });
}
