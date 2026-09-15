import { deleteApiForm, listApiForms, reorderApiForms,
  saveApiForm, setApiFormActive } from "@/lib/api/referencias-client";

export type Forma = {
  sync_uid: string;
  chave: string;
  rotulo: string;
  de_sistema: boolean;
  ativa: boolean;
  ordem: number;
};

export async function listarFormas(): Promise<Forma[]> {
  return listApiForms();
}

export type EntradaForma = {
  sync_uid?: string;
  chave?: string;
  rotulo: string;
  ativa: boolean;
  ordem: number;
  de_sistema?: boolean;
};

export async function salvarForma(f: EntradaForma): Promise<{ error?: string }> {
  try { return await saveApiForm(f); }
  catch (error) { return { error: error instanceof Error ? error.message : "Configuracao indisponivel" }; }
}

export async function definirFormaAtiva(sync_uid: string, ativa: boolean): Promise<{ error?: string }> {
  try { return await setApiFormActive(sync_uid, ativa); }
  catch (error) { return { error: error instanceof Error ? error.message : "Configuracao indisponivel" }; }
}

export async function excluirForma(sync_uid: string): Promise<{ error?: string }> {
  try { return await deleteApiForm(sync_uid); }
  catch (error) { return { error: error instanceof Error ? error.message : "Configuracao indisponivel" }; }
}

export async function reordenarFormas(ordenadas: Forma[]): Promise<{ error?: string }> {
  try { return await reorderApiForms(ordenadas); }
  catch (error) { return { error: error instanceof Error ? error.message : "Configuracao indisponivel" }; }
}
