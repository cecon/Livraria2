// Operador atual do caixa (feature 007, FR-023). Persistido em localStorage;
// carimbado em cada venda. Não é autenticação — é só atribuição de quem operou.
const CHAVE = "livraria.operadorAtual";

export function operadorAtual(): string {
  try {
    return localStorage.getItem(CHAVE) ?? "";
  } catch {
    return "";
  }
}

export function setOperadorAtual(usuario: string): void {
  try {
    if (usuario) localStorage.setItem(CHAVE, usuario);
    else localStorage.removeItem(CHAVE);
  } catch {
    /* ambiente sem localStorage — ignora */
  }
}
