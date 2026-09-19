import { invoke } from "@tauri-apps/api/core";
import type { Livro } from "./types";
import type { CredencialAdmin } from "@livraria/ui/ui/autorizacao-admin";
export type Produto = {
  uid: string; codigo: string; titulo: string; autor: string | null; precoCentavos: number;
  categoria: number; descricao: string | null; saldoPublicado: number;
  ativo: boolean; excluido: boolean; versao: string;
};
export type ProdutoResposta = { produto: Produto; livro: Livro | null; pendenteLocal: boolean };
export type PedidoProduto = {
  operacao: string; uid: string; acao: "criar" | "editar" | "contar"; versao?: string;
  quantidade?: number; dados?: { codigo: string; titulo: string; autor: string; descricao: string;
    preco_centavos: number; categoria: number; estoqueInicial: number; ativo?: boolean };
};
export const listarProdutos = (termo: string, pagina: number) => invoke<Produto[]>("produtos_listar", { termo, pagina });
export const consultarProduto = (codigo?: string, uid?: string) =>
  invoke<ProdutoResposta | null>("produto_consultar", { codigo: codigo ?? null, uid: uid ?? null });
export const salvarProduto = (pedido: PedidoProduto, autorizacao: CredencialAdmin) =>
  invoke<ProdutoResposta>("produto_salvar", { pedido, autorizacao });
export const erroProduto = (e: unknown): string => e instanceof Error ? e.message :
  (e as { mensagem?: string })?.mensagem ?? "Não foi possível concluir a operação.";
