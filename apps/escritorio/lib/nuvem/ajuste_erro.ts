// Ajuste manual de estoque (feature 014, ADR-0026) — partes puras: leitura da
// quantidade digitada e tradução dos códigos do domínio/nuvem para pt-BR.
// Sem Supabase aqui, para ser testável isoladamente.

export type CodigoAjuste = "AJUSTE_SEM_QUANTIDADE" | "MOTIVO_OBRIGATORIO" | "ESTOQUE_NEGATIVO";

/** Quantidade do ajuste: só inteiro exato com sinal opcional ("-2", "+3", "4"). */
export function lerQtdAjuste(texto: string): number | null {
  const t = texto.trim();
  return /^[+-]?\d+$/.test(t) ? Number(t) : null;
}

export function mensagemAjuste(codigo: string, saldoAtual?: number): string {
  switch (codigo) {
    case "AJUSTE_SEM_QUANTIDADE":
      return "Informe a quantidade (ex.: -2 ou 3)";
    case "MOTIVO_OBRIGATORIO":
      return "Motivo é obrigatório";
    case "ESTOQUE_NEGATIVO":
      return `O estoque ficaria negativo (atual: ${saldoAtual ?? 0})`;
    default:
      return "Ajuste inválido";
  }
}

/** Erro do Postgres no insert do ajuste → mensagem pt-BR (+ saldo oficial, se veio na recusa). */
export function traduzirErroAjuste(erro: { message: string; details?: string | null }): {
  error: string;
  saldoAtual?: number;
} {
  if (erro.message === "ESTOQUE_NEGATIVO") {
    const n = Number(erro.details);
    const saldoAtual = Number.isFinite(n) ? n : undefined;
    return { error: mensagemAjuste("ESTOQUE_NEGATIVO", saldoAtual), saldoAtual };
  }
  return { error: erro.message };
}
