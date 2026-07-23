/* tslint:disable */
/* eslint-disable */

/**
 * Quantidade do `saldo_inicial` que completa o ledger (ADR-0017): `estoque − Σ`.
 */
export function baseline_saldo_inicial(estoque_atual: number, soma_movimentos: number): number;

/**
 * Baixa efetiva de uma venda (ADR-0018): `min(qtd, saldo)`, nunca negativa.
 */
export function clamp_baixa_venda(qtd: number, saldo: number): number;

/**
 * Contagem efetiva no fechamento: parcial só ajusta contados; total zera
 * não-contados. `tem_contada=false` significa livro não contado.
 */
export function contagem_efetiva(modo: string, contada: number, tem_contada: boolean): any;

/**
 * Custo médio ponderado após uma entrada (centavos in/out).
 */
export function custo_medio_apos_entrada(estoque_atual: number, medio_centavos: number, qtd: number, custo_unit_centavos: number): number;

/**
 * Diferença de contagem de inventário: `contado − sistema`.
 */
export function diferenca_contagem(sistema: number, contado: number): number;

/**
 * Interpreta um valor pt-BR (`"R$ 12,50"`) em centavos.
 */
export function parse_brl(entrada: string): number;

/**
 * Fold do ledger (ADR-0009): recebe `[[qtd, custo|null], …]` e devolve
 * `{ saldo, custo_medio_centavos }`. Fonte única do custo médio no Escritório.
 */
export function recompor_ledger(movimentos: any): any;

/**
 * Restante a receber (centavos; 0 se pago ≥ total).
 */
export function restante_venda(itens: any, pagamentos: any): number;

/**
 * Resume os itens contados `[[sistema, contado], …]`.
 */
export function resumir(itens: any): any;

/**
 * Formata centavos como `R$ 1.234,56`.
 */
export function to_brl(centavos: number): string;

/**
 * Troco da venda (centavos; 0 se pago ≤ total).
 */
export function troco_venda(itens: any, pagamentos: any): number;

/**
 * Fechamento de caixa: diferença = conferido − esperado (pode ser < 0).
 */
export function turno_encerrar(esperado_dinheiro_centavos: number, conferido_dinheiro_centavos: number): any;

/**
 * Uma venda só pode ser registrada num turno "aberto".
 */
export function turno_pode_registrar_venda(status: string): boolean;

/**
 * Próximo Pedido Nº do turno (1..n).
 */
export function turno_proximo_numero(qtd_no_turno: number): number;

/**
 * Resume o fechamento: totais por forma (informativos) + esperado só do dinheiro.
 */
export function turno_resumir_fechamento(pagamentos_do_turno: any, caixa_inicial_centavos: number, dinheiro_forma_id: number, qtd_vendas: number): any;

/**
 * Valida a conclusão da venda (≥1 item, pago ≥ total, troco só do dinheiro).
 */
export function validar_conclusao_venda(itens: any, pagamentos: any, dinheiro_forma_id: number): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly baseline_saldo_inicial: (a: number, b: number) => number;
    readonly clamp_baixa_venda: (a: number, b: number) => number;
    readonly contagem_efetiva: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly custo_medio_apos_entrada: (a: number, b: number, c: number, d: number) => number;
    readonly diferenca_contagem: (a: number, b: number) => number;
    readonly parse_brl: (a: number, b: number) => [number, number, number];
    readonly recompor_ledger: (a: any) => [number, number, number];
    readonly restante_venda: (a: any, b: any) => [number, number, number];
    readonly resumir: (a: any) => [number, number, number];
    readonly to_brl: (a: number) => [number, number];
    readonly troco_venda: (a: any, b: any) => [number, number, number];
    readonly turno_encerrar: (a: number, b: number) => [number, number, number];
    readonly turno_pode_registrar_venda: (a: number, b: number) => number;
    readonly turno_proximo_numero: (a: number) => number;
    readonly turno_resumir_fechamento: (a: any, b: number, c: number, d: number) => [number, number, number];
    readonly validar_conclusao_venda: (a: any, b: any, c: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
