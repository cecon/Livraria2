// Cursors are opaque decimal sequences, never client timestamps.
export interface AlteracaoCatalogoV1 {
  sequencia: string;
  produtoUid: string;
  operacao: "upsert" | "delete";
  produto?: {
    codigo: string;
    titulo: string;
    precoCentavos: number;
    ativo: boolean;
    autor?: string | null;
    categoria?: number;
    descricao?: string | null;
    buscaNorm?: string;
    saldoPublicado?: number;
  };
}

export interface PaginaCatalogoV1 {
  versao: 1;
  alteracoes: AlteracaoCatalogoV1[];
  proximoCursor: string;
  temMais: boolean;
}

export interface ConfirmacaoCatalogoV1 {
  pdvUid: string;
  cursorAplicado: string;
}
