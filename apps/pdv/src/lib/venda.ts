// Lógica pura do PDV (sem React/IPC): pagamentos parametrizados pelas formas
// carregadas do cadastro (forma_id → centavos), rascunho e a coerção de valores
// para centavos inteiros. Mantido puro de propósito (ver venda.test.ts).

import type { ItemCarrinho } from "@/components/CarrinhoItens";

/** Pagamentos do PDV: mapa `formaId → centavos` (formas vêm do cadastro). */
export type Pagamentos = Record<number, number>;

export const PAG_VAZIO: Pagamentos = {};

export const RASCUNHO_KEY = "eldl-venda-rascunho";

export interface Rascunho {
  cliente: string;
  itens: ItemCarrinho[];
  pag: Pagamentos;
}

/** Coage qualquer valor para centavos inteiros. Garante `i64` no backend
 *  (FR-015): string "4500" -> 4500, "45,00"/null/NaN -> 0, 45.9 -> 45. */
export function paraCentavos(v: unknown): number {
  return Math.trunc(Number(v)) || 0;
}

/** Soma dos pagamentos lançados (centavos, sempre inteiro). */
export function somaPagamentos(pag: Pagamentos): number {
  return Object.values(pag).reduce((s, v) => s + paraCentavos(v), 0);
}

/** Pagamentos prontos para o payload IPC: lista esparsa `{formaId, valorCentavos}`
 *  só com formas de valor > 0, todo valor coagido a inteiro. */
export function pagamentosParaPayload(
  pag: Pagamentos,
): { formaId: number; valorCentavos: number }[] {
  return Object.entries(pag)
    .map(([id, v]) => ({ formaId: Number(id), valorCentavos: paraCentavos(v) }))
    .filter((r) => r.valorCentavos > 0);
}

/** Lê o JSON do rascunho. O pagamento NUNCA é restaurado (é transitório da
 *  venda atual): evita herdar valores antigos/incompatíveis de versões
 *  anteriores. Só cliente e itens voltam. JSON inválido -> null. */
export function parseRascunho(json: string | null): Rascunho | null {
  if (!json) return null;
  try {
    const r = JSON.parse(json) as Partial<Rascunho>;
    return {
      cliente: r.cliente ?? "CLIENTE",
      itens: Array.isArray(r.itens) ? r.itens : [],
      pag: {},
    };
  } catch {
    return null;
  }
}
