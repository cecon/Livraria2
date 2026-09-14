export type EstoqueStatusPedido =
  | "rascunho"
  | "pronta"
  | "incorporada"
  | "cancelada_estornada"
  | "divergente";

export type TipoDivergenciaEstoque =
  | "saldo_negativo"
  | "produto_inativo"
  | "venda_invalida"
  | "processamento_estoque";

export type StatusDivergenciaEstoque = "aberta" | "resolvida" | "ignorada";

export function payloadStatusDivergencia(
  status: Exclude<StatusDivergenciaEstoque, "aberta">,
  usuarioUid: string | null,
  atualizadoEm: string,
) {
  return {
    status,
    resolvida_em: atualizadoEm,
    resolvida_por: usuarioUid,
    atualizado_em: atualizadoEm,
  };
}
