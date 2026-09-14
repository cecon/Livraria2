// IPC do cadastro de formas de pagamento (feature 005) e estado do boot
// (FR-016a). Módulo próprio para manter ipc.ts < 300 linhas (Princípio III).

import { invoke } from "@tauri-apps/api/core";
import type { FormaPagamento } from "./types";

/** Estado do boot: em falha de migração o app abre só para exibir o erro. */
export interface EstadoBoot {
  ok: boolean;
  erroMigracao?: string;
}

export async function estadoBoot(): Promise<EstadoBoot> {
  return await invoke("estado_boot");
}


/** Só ativas, por ordem (PDV — FR-012). */
export async function listarFormasAtivas(): Promise<FormaPagamento[]> {
  return await invoke("listar_formas_ativas");
}





