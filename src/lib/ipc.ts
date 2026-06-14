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

export async function buscarPorTexto(termo: string): Promise<Livro[]> {
  return await invoke("buscar_por_texto", { termo });
}

export async function registrarVenda(
  input: VendaInput,
): Promise<PedidoResultado> {
  return await invoke("registrar_venda", { input });
}

export async function salvarLivro(livro: Livro): Promise<void> {
  await invoke("salvar_livro", { livro });
}

export async function excluirLivro(codigo: string): Promise<void> {
  await invoke("excluir_livro", { codigo });
}

export async function livrosRecentes(limite = 4): Promise<Livro[]> {
  return await invoke("livros_recentes", { limite });
}

export interface RelatorioMigracao {
  livrosImportados: number;
  pedidosInseridos: number;
  pedidosExistentes: number;
  divergencias: string[];
}

export async function migrarLegado(caminho?: string): Promise<RelatorioMigracao> {
  return await invoke("migrar_legado", { caminho: caminho ?? null });
}

export interface DashboardDia {
  vendasCentavos: number;
  itensVendidos: number;
  ticketMedioCentavos: number;
  estoqueBaixo: Livro[];
}

export async function dashboardDoDia(data?: string): Promise<DashboardDia> {
  return await invoke("dashboard_do_dia", { data: data ?? null });
}

export async function autenticar(usuario: string, senha: string): Promise<boolean> {
  return await invoke("autenticar", { usuario, senha });
}

export interface ItemRelatorio {
  id: number;
  titulo: string;
  qtd: number;
  valorCentavos: number;
}
export interface PedidoRelatorio {
  numero: number;
  cliente: string;
  itens: ItemRelatorio[];
  cartao: number;
  dinheiro: number;
  pix: number;
  ministerio: number;
  vale: number;
  totalCentavos: number;
}
export interface ResumoVendas {
  cartao: number;
  dinheiro: number;
  pix: number;
  ministerio: number;
  vale: number;
  subtotalCentavos: number;
}
export interface RelatorioVendas {
  periodo: string;
  data: string;
  pedidos: PedidoRelatorio[];
  resumo: ResumoVendas;
}
export interface ItemEstoque {
  codigo: string;
  titulo: string;
  categoria: number;
  precoCentavos: number;
  estoque: number;
  valorCentavos: number;
}
export interface RelatorioEstoque {
  titulos: number;
  valorTotalCentavos: number;
  itens: ItemEstoque[];
}

export async function relatorioVendas(
  data: string,
  periodo: string,
): Promise<RelatorioVendas> {
  return await invoke("relatorio_vendas", { data, periodo });
}

export async function relatorioEstoque(): Promise<RelatorioEstoque> {
  return await invoke("relatorio_estoque");
}

export async function excluirItemPedido(id: number): Promise<void> {
  await invoke("excluir_item_pedido", { id });
}
