// Camada IPC: wrappers tipados sobre `invoke` (contracts/tauri-commands.md).
// Os comandos de domínio (venda, cadastro, pesquisa...) entram conforme as user stories.

import { invoke } from "@tauri-apps/api/core";

/** Aplica as migrations idempotentes (FR-061). */
export async function inicializarDados(): Promise<void> {
  await invoke("inicializar_dados");
}
