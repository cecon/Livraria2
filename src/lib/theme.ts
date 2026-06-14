// Tema claro/escuro com persistência em localStorage (FR-053), chave "eldl-theme".

const KEY = "eldl-theme";
export type Tema = "light" | "dark";

export function temaInicial(): Tema {
  const salvo = localStorage.getItem(KEY);
  if (salvo === "dark" || salvo === "light") return salvo;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function aplicarTema(t: Tema): void {
  document.documentElement.classList.toggle("dark", t === "dark");
  localStorage.setItem(KEY, t);
}
