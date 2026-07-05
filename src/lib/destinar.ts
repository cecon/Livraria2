// Lógica pura da tela "Destinar estoque" (US1) — extraída do componente para
// ser testável no Vitest sem DOM (mesmo padrão de venda.ts).

import type { Destinacao, SaldoLivro } from "./types";

/** Valor sentinela do saldo livre nos selects (backend recebe null). */
export const LIVRE = "livre";

export interface Opcao {
  valor: string;
  rotulo: string;
}

/** Origens: Livre (com saldo) + carimbos existentes, na ordem de baixa. */
export function opcoesOrigem(saldos: SaldoLivro | null): Opcao[] {
  return [
    { valor: LIVRE, rotulo: `Livre (${saldos?.livre ?? 0})` },
    ...(saldos?.carimbos ?? []).map((c) => ({
      valor: String(c.destinacaoId),
      rotulo: `${c.nome} (${c.qtd})`,
    })),
  ];
}

/** Destinos: Livre + destinações ativas (a Loja inclusive — carimbo Loja dá
 *  prioridade de venda ao lote), exceto a própria origem. */
export function opcoesDestino(ativas: Destinacao[], de: string): Opcao[] {
  return [
    { valor: LIVRE, rotulo: "Livre" },
    ...ativas.map((d) => ({ valor: String(d.id), rotulo: d.nome })),
  ].filter((o) => o.valor !== de);
}

/** Valida o form antes do IPC; retorna a mensagem de erro ou null se ok. */
export function validarTransferenciaUi(qtd: string, para: string): string | null {
  const n = parseInt(qtd, 10);
  if (!n || Number.isNaN(n) || n <= 0) return "Informe a quantidade (mínimo 1)";
  if (!para) return "Escolha o destino";
  return null;
}

/** Converte o valor do select para o payload do IPC (null = livre). */
export function paraPayload(valor: string): number | null {
  return valor === LIVRE ? null : Number(valor);
}
