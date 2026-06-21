// Lógica pura do PDV (sem React/IPC): formas de pagamento, rascunho e a
// coerção de valores para centavos inteiros — o que cruza a fronteira Tauri.
// Mantido puro de propósito para ser testável (ver venda.test.ts).

import type { ItemCarrinho } from "@/components/CarrinhoItens";

export type FormaKey = "cartao" | "dinheiro" | "pix" | "ministerio" | "vale";

export const FORMA_KEYS: FormaKey[] = [
  "cartao",
  "dinheiro",
  "pix",
  "ministerio",
  "vale",
];

export type Pagamentos = Record<FormaKey, number>;

export const PAG_VAZIO: Pagamentos = {
  cartao: 0,
  dinheiro: 0,
  pix: 0,
  ministerio: 0,
  vale: 0,
};

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

/** Pagamentos prontos para o payload IPC: toda forma vira inteiro. */
export function pagamentosParaPayload(pag: Pagamentos): Pagamentos {
  return {
    cartao: paraCentavos(pag.cartao),
    dinheiro: paraCentavos(pag.dinheiro),
    pix: paraCentavos(pag.pix),
    ministerio: paraCentavos(pag.ministerio),
    vale: paraCentavos(pag.vale),
  };
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
      pag: { ...PAG_VAZIO },
    };
  } catch {
    return null;
  }
}
