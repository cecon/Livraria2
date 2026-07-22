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
 * Formata centavos como `R$ 1.234,56`.
 */
export function to_brl(centavos: number): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly baseline_saldo_inicial: (a: number, b: number) => number;
    readonly clamp_baixa_venda: (a: number, b: number) => number;
    readonly custo_medio_apos_entrada: (a: number, b: number, c: number, d: number) => number;
    readonly diferenca_contagem: (a: number, b: number) => number;
    readonly parse_brl: (a: number, b: number) => [number, number, number];
    readonly recompor_ledger: (a: any) => [number, number, number];
    readonly to_brl: (a: number) => [number, number];
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
