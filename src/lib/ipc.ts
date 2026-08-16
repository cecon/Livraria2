// Camada IPC: wrappers tipados sobre `invoke` (contracts/tauri-commands.md).
// Erros chegam como { codigo, mensagem } (ErroDto do Rust).

import { invoke } from "@tauri-apps/api/core";
import type { Livro, Movimento, Recebimento } from "./types";

export interface ErroIpc {
  codigo: string;
  mensagem: string;
}

export interface ItemVenda {
  codigo: string;
  qtd: number;
}

/** Recebimento do payload de venda: forma do cadastro + valor em centavos. */
export interface RecebimentoInput {
  formaId: number;
  valorCentavos: number;
}

export interface VendaInput {
  cliente: string;
  itens: ItemVenda[];
  /** Lista esparsa: só formas com valor > 0 (FR-012). */
  pagamentos: RecebimentoInput[];
  /** Operador que fez a venda (feature 007, FR-023). Opcional. */
  operador?: string;
}

export interface OperadorDto {
  usuario: string;
  nome?: string | null;
}

// Lista de operadores do PDV para o caixa escolher (feature 007).
export async function listarOperadores(): Promise<OperadorDto[]> {
  return await invoke("listar_operadores");
}

export interface PedidoResultado {
  numero: number;
  totalCentavos: number;
  trocoCentavos: number;
  totalItens: number;
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

// --- Turno de operação (feature 009, ADR-0021) ---

// Feature 013: o turno pertence à MÁQUINA (um aberto por PDV) — quem loga
// continua no turno aberto; `operador`/`maquina` identificam-no na tela.
export type TurnoAberto = {
  syncUid: string;
  caixaInicialCentavos: number;
  abertura: string;
  operador: string;
  maquina: string;
};
export type ResumoTurno = { qtdVendas: number; porForma: [number, number][]; esperadoDinheiroCentavos: number };
export type TurnoFechamento = { esperadoCentavos: number; conferidoCentavos: number; diferencaCentavos: number };
export type TurnoHistorico = {
  abertura: string;
  encerramento: string | null;
  status: string;
  esperadoCentavos: number | null;
  conferidoCentavos: number | null;
  diferencaCentavos: number | null;
};

/** Turno aberto DESTA máquina (sem argumento: a identidade é o PC, não o usuário). */
export async function turnoAberto(): Promise<TurnoAberto | null> {
  return await invoke("turno_aberto");
}
/** Abre um turno ou continua no que já está aberto nesta máquina (FR-002/FR-017). */
export async function turnoAbrir(operador: string, caixaInicialCentavos: number): Promise<TurnoAberto> {
  return await invoke("turno_abrir", { operador, caixaInicialCentavos });
}
/** Nome do PC — exibido mesmo sem turno aberto (FR-021). */
export async function maquinaNome(): Promise<string> {
  return await invoke("maquina_nome");
}
export async function turnoResumo(turnoUid: string): Promise<ResumoTurno> {
  return await invoke("turno_resumo", { turnoUid });
}
export async function turnoEncerrar(turnoUid: string, conferidoCentavos: number): Promise<TurnoFechamento> {
  return await invoke("turno_encerrar", { turnoUid, conferidoCentavos });
}
export async function turnoListar(operador: string): Promise<TurnoHistorico[]> {
  return await invoke("turno_listar", { operador });
}

export async function autenticar(usuario: string, senha: string): Promise<boolean> {
  return await invoke("autenticar", { usuario, senha });
}

// --- Relatórios (vendas + estoque) ---

/** Distribuição do item por destinação (006 — Loja já consolidada no backend). */
export interface AlocacaoItem {
  destinacaoId: number;
  nome: string;
  qtd: number;
  valorCentavos: number;
}
export interface ItemRelatorio {
  id: number;
  codigo: string;
  titulo: string;
  qtd: number;
  valorCentavos: number;
  /** Vazio = sem carimbo envolvido (100% Loja). */
  alocacoes: AlocacaoItem[];
}
export interface PedidoRelatorio {
  numero: number;
  cliente: string;
  itens: ItemRelatorio[];
  /** Recebido por forma do cadastro, na ordem (FR-019). */
  recebimentos: Recebimento[];
  totalCentavos: number;
  cancelado: boolean;
  /**
   * Feature 013 (FR-003): a venda é do turno aberto deste PDV? Só ela pode ser
   * cancelada/reaberta aqui — o resto se corrige no escritório.
   */
  cancelavel: boolean;
}
/** Total por forma do cadastro (inclui zeros, na ordem). */
export interface TotalForma {
  formaId: number;
  rotulo: string;
  totalCentavos: number;
}
export interface ResumoVendas {
  formas: TotalForma[];
  subtotalCentavos: number;
}
/** Livro dentro do repasse por destinação (fechamento do dia — 006). */
export interface LivroRepasse {
  titulo: string;
  qtd: number;
  valorCentavos: number;
}
/** Repasse por destinação: livros vendidos + total a repassar. */
export interface RepasseDestinacao {
  destinacaoId: number;
  nome: string;
  qtd: number;
  valorCentavos: number;
  livros: LivroRepasse[];
}
export interface RelatorioVendas {
  periodo: string;
  data: string;
  pedidos: PedidoRelatorio[];
  resumo: ResumoVendas;
  /** Vazio quando nada foi vendido no período. */
  repasses: RepasseDestinacao[];
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

export async function excluirPedido(numero: number): Promise<void> {
  await invoke("excluir_pedido", { numero });
}

export async function extratoLivro(
  codigo: string,
  limite = 0,
): Promise<Movimento[]> {
  return await invoke("extrato_livro", { codigo, limite });
}

// Cadastro de formas de pagamento & estado do boot (feature 005).
export * from "./ipc_formas";
// Destinações de estoque (feature 006).
export * from "./ipc_destinacoes";
