export const apiOnlyMode = () => process.env.API_ONLY_MODE === "true";

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

export const apiFeaturesEnabled = () => apiOnlyMode() ||
  process.env.API_CATALOGO_ENABLED === "true" ||
  process.env.API_REFERENCIAS_ENABLED === "true" ||
  process.env.API_USUARIOS_ENABLED === "true" ||
  process.env.API_PDV_STATUS_ENABLED === "true" ||
  process.env.API_ESTOQUE_ENABLED === "true" ||
  process.env.API_LANCAMENTOS_ENABLED === "true" ||
  process.env.API_TURNOS_ENABLED === "true" ||
  process.env.API_VENDAS_ENABLED === "true" ||
  process.env.API_RELATORIOS_ENABLED === "true";
