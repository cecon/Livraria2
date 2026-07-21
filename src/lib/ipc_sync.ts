// Camada IPC da sincronização (feature 007). Wrappers tipados sobre `invoke`.
import { invoke } from "@tauri-apps/api/core";

export interface ResumoSync {
  enviados: number;
  recebidos: number;
  orfas: number;
}

export interface StatusSync {
  pendentes: number;
}

// Dispara uma sincronização completa (push→pull→recompute).
export function sincronizarAgora(): Promise<ResumoSync> {
  return invoke<ResumoSync>("sincronizar_agora");
}

// Estado local (não usa rede): quantos registros faltam sincronizar.
export function statusSincronizacao(): Promise<StatusSync> {
  return invoke<StatusSync>("status_sincronizacao");
}
