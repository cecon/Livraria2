// Janela de retenção do PDV (feature 013, FR-012): o PDV guarda ~45 dias de
// vendas; o que é mais antigo foi podado daqui e vive na nuvem/escritório.
// As telas de consulta usam isto para não oferecer um período que já não existe
// localmente — e dizer onde procurar o resto.

export const RETENCAO_DIAS = 45;

export const AVISO_RETENCAO = `O PDV guarda os últimos ${RETENCAO_DIAS} dias. O histórico completo fica no escritório.`;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Data mais antiga consultável no PDV (hoje − 45 dias), em yyyy-mm-dd. */
export function dataMinimaRetencao(): string {
  const d = new Date();
  d.setDate(d.getDate() - RETENCAO_DIAS);
  return iso(d);
}

/** A data pedida está fora da janela local? */
export function foraDaRetencao(data: string): boolean {
  return data < dataMinimaRetencao();
}
