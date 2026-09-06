// Pedido Nº exibido (feature 013, FR-016): a venda é identificada por
// turno + número dentro do turno, e a numeração reinicia em 1 a cada turno.
// O `numero` global continua existindo como chave contínua, mas não é o que
// aparece na tela. Venda legada (sem turno) cai no número global.

export function pedidoNo(p: { numero: number; numeroNoTurno?: number | null }): number {
  return p.numeroNoTurno ?? p.numero;
}
