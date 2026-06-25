// Tipos e constantes de domínio espelhados no front (contracts/tauri-commands.md).
// Dinheiro em centavos (inteiro).

// --- Fornecedores & lançamento de notas (feature 003) ---

export interface Fornecedor {
  id: number;
  nome: string;
  documento?: string | null;
  telefone?: string | null;
  email?: string | null;
  observacoes?: string | null;
  ativo: boolean;
}

export type StatusLancamento = "rascunho" | "finalizada" | "cancelada";

export interface ItemNota {
  itemId: number;
  codigo: string;
  titulo: string;
  qtd: number;
  custoUnitCentavos: number;
  subtotalCentavos: number;
}

export interface LancamentoResumo {
  id: number;
  fornecedorNome?: string | null;
  data: string;
  status: StatusLancamento;
  totalCentavos: number;
  qtdItens: number;
}

export interface PaginaLancamentos {
  itens: LancamentoResumo[];
  total: number;
}

export interface LancamentoDetalhe {
  id: number;
  fornecedorId?: number | null;
  fornecedorNome?: string | null;
  numero?: string | null;
  data: string;
  status: StatusLancamento;
  totalCentavos: number;
  itens: ItemNota[];
}

export interface Livro {
  codigo: string;
  titulo: string;
  autor?: string | null;
  precoCentavos: number;
  categoria: number;
  estoque: number;
  descricao?: string | null;
  codigoBarras?: string | null;
  custoMedioCentavos?: number;
}

/** Página de livros (lista + total) para paginação no banco. */
export interface PaginaLivros {
  itens: Livro[];
  total: number;
}

/** Tipos de movimento da razão de estoque (ADR-0008). */
export type TipoMovimento =
  | "saldo_inicial"
  | "entrada"
  | "saida_venda"
  | "ajuste"
  | "contagem"
  | "estorno";

/** Rótulos pt-BR dos tipos de movimento. */
export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  saldo_inicial: "Saldo inicial",
  entrada: "Entrada",
  saida_venda: "Venda",
  ajuste: "Ajuste",
  contagem: "Inventário",
  estorno: "Estorno",
};

/** Linha do extrato de movimentação (FR-050). */
export interface Movimento {
  id: number;
  tipo: TipoMovimento;
  qtd: number;
  saldoResultante: number;
  custoUnitCentavos?: number | null;
  fornecedor?: string | null;
  motivo?: string | null;
  referencia?: string | null;
  criadoEm: string;
}

/** Sessão de inventário (US2). */
export interface Sessao {
  id: number;
  modo: "parcial" | "total";
  rotulo?: string | null;
  status: "aberta" | "fechada" | "cancelada";
  abertaEm: string;
}

export interface Divergencia {
  codigo: string;
  titulo: string;
  qtdSistema: number;
  qtdContada: number;
  diferenca: number;
}

export interface Pendencia {
  id: number;
  codigoLido: string;
  qtd: number;
  resolvida: boolean;
}

export interface Bipagem {
  encontrado: boolean;
  livro?: Livro | null;
  qtdContada?: number | null;
  pendencia?: Pendencia | null;
}

export interface Fechamento {
  sessaoId: number;
  ajustados: Divergencia[];
  totalDiferencas: number;
  pendencias: Pendencia[];
}

/** Enum fixo de categorias (Constituição, Princípio VI) — "id — nome". */
export const CATEGORIAS: readonly { id: number; nome: string }[] = [
  { id: 0, nome: "Não Categorizado" },
  { id: 1, nome: "Bíblias" },
  { id: 2, nome: "Infantil" },
  { id: 3, nome: "Família" },
  { id: 4, nome: "Devocional" },
  { id: 5, nome: "Estudo & Teologia" },
  { id: 6, nome: "Ficção" },
] as const;

/** Ordem e rótulos exatos das formas de pagamento (FR-013). */
export const FORMAS_PAGAMENTO = [
  "Cartão",
  "Dinheiro",
  "PIX",
  "Ministério",
  "Vale Presente",
] as const;

export type SeloEstoque = "esgotado" | "baixo" | "normal";

/** Regra de selo de estoque (FR-051) — espelha domain::livro::selo. */
export function seloEstoque(estoque: number): SeloEstoque {
  if (estoque <= 0) return "esgotado";
  if (estoque <= 3) return "baixo";
  return "normal";
}
