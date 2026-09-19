import { parseRascunho, RASCUNHO_KEY, type Rascunho } from "./venda";

// Navegar no mesmo app mantém pagamentos; reiniciar mantém a política do rascunho.
let atual: Rascunho | null = null;
export function vendaEmAndamento() {
  return atual ?? parseRascunho(localStorage.getItem(RASCUNHO_KEY));
}
export function guardarVenda(rascunho: Rascunho) {
  atual = rascunho;
  localStorage.setItem(RASCUNHO_KEY, JSON.stringify(rascunho));
}
