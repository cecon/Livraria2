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

/** Todas as formas, por ordem (inclui inativas — tela de cadastro). */
export async function listarFormas(): Promise<FormaPagamento[]> {
  return await invoke("listar_formas");
}

/** Só ativas, por ordem (PDV — FR-012). */
export async function listarFormasAtivas(): Promise<FormaPagamento[]> {
  return await invoke("listar_formas_ativas");
}

export async function criarForma(
  rotulo: string,
  ativa = true,
): Promise<FormaPagamento> {
  return await invoke("criar_forma", { rotulo, ativa });
}

export async function renomearForma(
  id: number,
  rotulo: string,
): Promise<FormaPagamento> {
  return await invoke("renomear_forma", { id, rotulo });
}

export async function definirFormaAtiva(
  id: number,
  ativa: boolean,
): Promise<FormaPagamento> {
  return await invoke("definir_forma_ativa", { id, ativa });
}

export async function reordenarFormas(
  idsOrdenados: number[],
): Promise<FormaPagamento[]> {
  return await invoke("reordenar_formas", { idsOrdenados });
}

export async function excluirForma(id: number): Promise<void> {
  await invoke("excluir_forma", { id });
}
