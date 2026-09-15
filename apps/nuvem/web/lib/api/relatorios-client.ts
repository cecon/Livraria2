let mode: Promise<boolean> | undefined;
export function reportsApiEnabled() {
  mode ??= fetch("/api/relatorios/config", { cache: "no-store", signal: AbortSignal.timeout(10000) })
    .then(async response => {
      if (!response.ok) throw new Error("Configuracao de relatorios indisponivel");
      const result = await response.json();
      if (typeof result.enabled !== "boolean") throw new Error("Configuracao invalida");
      return result.enabled as boolean;
    }).catch(error => { mode = undefined; throw error; });
  return mode;
}
export async function reportsRequest(resource: string, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const response = await fetch(`/api/relatorios/${resource}${query}`, { cache: "no-store",
    signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.erro || "Relatorio indisponivel");
  return result;
}
