// IPC das destinações (feature 006 — ADR-0014): cadastro, destinar estoque e
// relatório. Módulo próprio para manter ipc.ts < 300 linhas (Princípio III).

import { invoke } from "@tauri-apps/api/core";
import type { Destinacao, SaldoLivro, Transferencia } from "./types";

// --- Cadastro (US3) ---

/** Todas, por ordem (inclui inativas — tela de cadastro). */
export async function destinacoesListar(): Promise<Destinacao[]> {
  return await invoke("destinacoes_listar");
}

/** Só ativas, por ordem (selects de transferência). */
export async function destinacoesListarAtivas(): Promise<Destinacao[]> {
  return await invoke("destinacoes_listar_ativas");
}

export async function destinacaoCriar(nome: string): Promise<Destinacao> {
  return await invoke("destinacao_criar", { nome });
}

export async function destinacaoRenomear(
  id: number,
  nome: string,
): Promise<Destinacao> {
  return await invoke("destinacao_renomear", { id, nome });
}

export async function destinacaoDefinirAtiva(
  id: number,
  ativa: boolean,
): Promise<Destinacao> {
  return await invoke("destinacao_definir_ativa", { id, ativa });
}

/** Ids das destinações LIVRES na nova ordem; a Loja fica fixa no topo. */
export async function destinacaoReordenar(ids: number[]): Promise<Destinacao[]> {
  return await invoke("destinacao_reordenar", { ids });
}

export async function destinacaoExcluir(id: number): Promise<void> {
  await invoke("destinacao_excluir", { id });
}

// --- Destinar estoque (US1) ---

export async function destinacaoSaldosLivro(codigo: string): Promise<SaldoLivro> {
  return await invoke("destinacao_saldos_livro", { codigo });
}

/** Transfere entre livre (`null`) e carimbos, sem tocar no estoque físico. */
export async function destinacaoTransferir(
  codigo: string,
  deDestinacaoId: number | null,
  paraDestinacaoId: number | null,
  qtd: number,
  motivo?: string,
): Promise<SaldoLivro> {
  return await invoke("destinacao_transferir", {
    codigo,
    deDestinacaoId,
    paraDestinacaoId,
    qtd,
    motivo: motivo ?? null,
  });
}

/** Histórico de transferências do livro, mais recente primeiro. */
export async function destinacaoTransferenciasLivro(
  codigo: string,
): Promise<Transferencia[]> {
  return await invoke("destinacao_transferencias_livro", { codigo });
}
