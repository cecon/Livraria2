import { deleteApiDestination, listApiDestinations,
  reorderApiDestinations, saveApiDestination, setApiDestinationActive } from "@/lib/api/referencias-client";

export type Destinacao = {
  sync_uid: string;
  nome: string;
  de_sistema: boolean;
  ativa: boolean;
  ordem: number;
};

export async function listarDestinacoes(): Promise<Destinacao[]> {
  return listApiDestinations();
}

export type EntradaDestinacao = { sync_uid?: string; nome: string; ativa: boolean; ordem: number; de_sistema?: boolean };

export async function salvarDestinacao(d: EntradaDestinacao): Promise<{ error?: string }> {
  try { return await saveApiDestination(d); }
  catch (error) { return { error: error instanceof Error ? error.message : "Configuracao indisponivel" }; }
}

export async function definirDestinacaoAtiva(sync_uid: string, ativa: boolean): Promise<{ error?: string }> {
  try { return await setApiDestinationActive(sync_uid, ativa); }
  catch (error) { return { error: error instanceof Error ? error.message : "Configuracao indisponivel" }; }
}

export async function excluirDestinacao(sync_uid: string): Promise<{ error?: string }> {
  try { return await deleteApiDestination(sync_uid); }
  catch (error) { return { error: error instanceof Error ? error.message : "Configuracao indisponivel" }; }
}

export async function reordenarDestinacoes(livresOrdenadas: Destinacao[]): Promise<{ error?: string }> {
  try { return await reorderApiDestinations(livresOrdenadas); }
  catch (error) { return { error: error instanceof Error ? error.message : "Configuracao indisponivel" }; }
}
