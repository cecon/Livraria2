// Camada IPC da feature 003 (fornecedores & lançamentos de nota).
// Reexportado por `ipc.ts` — componentes seguem importando de "@/lib/ipc".

import { invoke } from "@tauri-apps/api/core";
import type { Fornecedor, LancamentoDetalhe, PaginaLancamentos } from "./types";

// --- Fornecedores ---

export interface FornecedorInput {
  id?: number;
  nome: string;
  documento?: string | null;
  telefone?: string | null;
  email?: string | null;
  observacoes?: string | null;
}

export async function fornecedoresListar(termo = ""): Promise<Fornecedor[]> {
  return await invoke("fornecedores_listar", { termo });
}

export async function fornecedorSalvar(
  fornecedor: FornecedorInput,
): Promise<Fornecedor> {
  return await invoke("fornecedor_salvar", { fornecedor });
}

export async function fornecedorExcluir(id: number): Promise<void> {
  await invoke("fornecedor_excluir", { id });
}

// --- Lançamentos de nota ---

export async function lancamentosListar(
  pagina = 1,
  porPagina = 12,
): Promise<PaginaLancamentos> {
  return await invoke("lancamentos_listar", { pagina, porPagina });
}

export async function lancamentoObter(
  id: number,
): Promise<LancamentoDetalhe | null> {
  return await invoke("lancamento_obter", { id });
}

export async function lancamentoCriar(
  fornecedorId?: number,
): Promise<LancamentoDetalhe> {
  return await invoke("lancamento_criar", { fornecedorId: fornecedorId ?? null });
}

export async function lancamentoDefinirFornecedor(
  id: number,
  fornecedorId: number,
  numero?: string,
): Promise<void> {
  await invoke("lancamento_definir_fornecedor", {
    id,
    fornecedorId,
    numero: numero ?? null,
  });
}

export async function lancamentoAdicionarItem(
  id: number,
  codigo: string,
  qtd: number,
  custoTotalCentavos?: number,
  custoUnitCentavos?: number,
): Promise<LancamentoDetalhe> {
  return await invoke("lancamento_adicionar_item", {
    id,
    codigo,
    qtd,
    custoTotalCentavos: custoTotalCentavos ?? null,
    custoUnitCentavos: custoUnitCentavos ?? null,
  });
}

export async function lancamentoRemoverItem(
  id: number,
  itemId: number,
): Promise<LancamentoDetalhe> {
  return await invoke("lancamento_remover_item", { id, itemId });
}

export async function lancamentoExcluir(id: number): Promise<void> {
  await invoke("lancamento_excluir", { id });
}

export async function lancamentoFinalizar(
  id: number,
): Promise<LancamentoDetalhe> {
  return await invoke("lancamento_finalizar", { id });
}

/** Cancela (estorna) uma nota finalizada — reverte o estoque. */
export async function lancamentoCancelar(
  id: number,
): Promise<LancamentoDetalhe> {
  return await invoke("lancamento_cancelar", { id });
}
