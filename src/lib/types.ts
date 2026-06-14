// Tipos e constantes de domínio espelhados no front (contracts/tauri-commands.md).
// Dinheiro em centavos (inteiro).

export interface Livro {
  codigo: string;
  titulo: string;
  autor?: string | null;
  precoCentavos: number;
  categoria: number;
  estoque: number;
  descricao?: string | null;
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
