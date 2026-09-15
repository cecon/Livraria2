import { catalogRequest, listApiBooks, saveApiBook } from "@/lib/api/catalogo-client";

export type Livro = {
  sync_uid: string;
  codigo: string;
  titulo: string;
  autor: string | null;
  preco_centavos: number;
  categoria: number;
  descricao: string | null;
  ativo: boolean;
};

export async function listarLivros(): Promise<Livro[]> {
  return listApiBooks();
}

export type EntradaLivro = {
  sync_uid?: string;
  codigo: string;
  titulo: string;
  autor: string;
  preco_centavos: number;
  categoria: number;
  descricao: string;
  estoqueInicial?: number; // só para livro NOVO — vira um movimento `saldo_inicial`.
};

export async function salvarLivro(e: EntradaLivro): Promise<{ error?: string }> {
  return saveApiBook(e);
}

export async function excluirLivro(sync_uid: string): Promise<{ error?: string }> {
  try {
    await catalogRequest(`/${sync_uid}`, "DELETE");
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao excluir" };
  }
}
