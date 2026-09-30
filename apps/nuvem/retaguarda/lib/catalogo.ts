// Categorias do livro (0–6, Constituição VI) — mesmas do PDV.
export const CATEGORIAS: readonly { id: number; nome: string }[] = [
  { id: 0, nome: "Não Categorizado" },
  { id: 1, nome: "Bíblias" },
  { id: 2, nome: "Infantil" },
  { id: 3, nome: "Família" },
  { id: 4, nome: "Devocional" },
  { id: 5, nome: "Estudo & Teologia" },
  { id: 6, nome: "Ficção" },
] as const;
