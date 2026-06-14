// Camada IPC: wrappers tipados sobre `invoke` (contracts/tauri-commands.md).
// Erros chegam como { codigo, mensagem } (ErroDto do Rust).

import { invoke } from "@tauri-apps/api/core";
import type { Livro } from "./types";

export interface ErroIpc {
  codigo: string;
  mensagem: string;
}

export interface ItemVenda {
  codigo: string;
  qtd: number;
}

export interface PagamentosInput {
  cartao: number;
  dinheiro: number;
  pix: number;
  ministerio: number;
  vale: number;
}

export interface VendaInput {
  cliente: string;
  itens: ItemVenda[];
  pagamentos: PagamentosInput;
}

export interface PedidoResultado {
  numero: number;
  totalCentavos: number;
  trocoCentavos: number;
  totalItens: number;
}

/** Aplica as migrations idempotentes (FR-061). */
export async function inicializarDados(): Promise<void> {
  await invoke("inicializar_dados");
}

export async function proximoNumeroPedido(): Promise<number> {
  return await invoke("proximo_numero_pedido");
}

export async function livroPorCodigo(codigo: string): Promise<Livro | null> {
  return await invoke("livro_por_codigo", { codigo });
}

export async function registrarVenda(
  input: VendaInput,
): Promise<PedidoResultado> {
  return await invoke("registrar_venda", { input });
}

export async function salvarLivro(livro: Livro): Promise<void> {
  await invoke("salvar_livro", { livro });
}
