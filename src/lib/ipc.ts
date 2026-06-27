// Camada IPC: wrappers tipados sobre `invoke` (contracts/tauri-commands.md).
// Erros chegam como { codigo, mensagem } (ErroDto do Rust).

import { invoke } from "@tauri-apps/api/core";
import type {
  Bipagem,
  Divergencia,
  Fechamento,
  PaginaLivros,
  Livro,
  Movimento,
  Pendencia,
  RelatorioSessao,
  Sessao,
} from "./types";

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

/** Lista paginada de livros no banco (busca opcional) — Cadastro. */
export async function livrosPagina(
  termo = "",
  pagina = 1,
  porPagina = 12,
): Promise<PaginaLivros> {
  return await invoke("livros_pagina", { termo, pagina, porPagina });
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
  totalLivros: number;
  totalEstoque: number;
  estoqueBaixo: Livro[];
}

export type PeriodoDash = "hoje" | "7dias" | "mes" | "ano";

export async function dashboardDoDia(
  periodo: PeriodoDash = "hoje",
): Promise<DashboardDia> {
  return await invoke("dashboard_do_dia", { periodo });
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

export async function excluirPedido(numero: number): Promise<void> {
  await invoke("excluir_pedido", { numero });
}

// --- Estoque: ajuste, extrato (feature 002) ---

/** Ajuste avulso de estoque (± qtd) com motivo. Retorna o livro atualizado. */
export async function registrarAjuste(
  codigo: string,
  qtd: number,
  motivo: string,
): Promise<Livro> {
  return await invoke("registrar_ajuste", { codigo, qtd, motivo });
}

export async function extratoLivro(
  codigo: string,
  limite = 0,
): Promise<Movimento[]> {
  return await invoke("extrato_livro", { codigo, limite });
}

// --- Inventário (feature 002) ---

export async function inventarioAbrir(
  modo: "parcial" | "total",
  rotulo?: string,
): Promise<Sessao> {
  return await invoke("inventario_abrir", { modo, rotulo: rotulo ?? null });
}

export async function inventarioSessaoAberta(): Promise<Sessao | null> {
  return await invoke("inventario_sessao_aberta");
}

export async function inventarioBipar(
  sessaoId: number,
  codigoBarras: string,
): Promise<Bipagem> {
  return await invoke("inventario_bipar", { sessaoId, codigoBarras });
}

/** Desfaz uma bipagem (−1). Se zerar, remove o livro da contagem. */
export async function inventarioDesbipar(
  sessaoId: number,
  codigoBarras: string,
): Promise<Bipagem> {
  return await invoke("inventario_desbipar", { sessaoId, codigoBarras });
}

export async function inventarioAjustarItem(
  sessaoId: number,
  codigo: string,
  qtdContada: number,
): Promise<void> {
  await invoke("inventario_ajustar_item", { sessaoId, codigo, qtdContada });
}

export async function inventarioRevisao(
  sessaoId: number,
): Promise<Divergencia[]> {
  return await invoke("inventario_revisao", { sessaoId });
}

export async function inventarioFechar(
  sessaoId: number,
  confirmarTotal = false,
): Promise<Fechamento> {
  return await invoke("inventario_fechar", { sessaoId, confirmarTotal });
}

export async function inventarioCancelar(sessaoId: number): Promise<void> {
  await invoke("inventario_cancelar", { sessaoId });
}

export async function inventarioDivergencias(
  sessaoId: number,
): Promise<Divergencia[]> {
  return await invoke("inventario_divergencias", { sessaoId });
}

export async function inventarioRealizados(): Promise<Sessao[]> {
  return await invoke("inventario_realizados");
}

export async function inventarioRelatorio(
  sessaoId: number,
): Promise<RelatorioSessao> {
  return await invoke("inventario_relatorio", { sessaoId });
}

export async function inventarioPendencias(
  apenasAbertas = true,
): Promise<Pendencia[]> {
  return await invoke("inventario_pendencias", { apenasAbertas });
}

export async function resolverPendencia(pendenciaId: number): Promise<void> {
  await invoke("resolver_pendencia", { pendenciaId });
}

export async function buscarPorCodigoBarras(
  codigoBarras: string,
): Promise<Livro | null> {
  return await invoke("buscar_por_codigo_barras", { codigoBarras });
}

// Fornecedores & lançamentos de nota (feature 003) — em módulo próprio.
export * from "./ipc_compras";
