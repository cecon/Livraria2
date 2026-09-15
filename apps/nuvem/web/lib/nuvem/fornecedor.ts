import { deleteApiSupplier, listApiSuppliers, saveApiSupplier } from "@/lib/api/referencias-client";

export type Fornecedor = {
  sync_uid: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ativo: boolean;
};

export async function listarFornecedores(): Promise<Fornecedor[]> {
  return listApiSuppliers();
}

export type EntradaFornecedor = Partial<Fornecedor> & { nome: string };

export async function salvarFornecedor(f: EntradaFornecedor): Promise<{ error?: string }> {
  try { return await saveApiSupplier(f); }
  catch (error) { return { error: error instanceof Error ? error.message : "Configuracao indisponivel" }; }
}

export async function inativarFornecedor(sync_uid: string): Promise<{ error?: string }> {
  try { return await deleteApiSupplier(sync_uid); }
  catch (error) { return { error: error instanceof Error ? error.message : "Configuracao indisponivel" }; }
}
