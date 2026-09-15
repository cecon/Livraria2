export function apiOrigin() {
  const value = process.env.NUVEM_API_URL;
  if (!value) throw new Error("API nao configurada");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/") {
    throw new Error("Origem API invalida");
  }
  return url.origin;
}
