export async function reportsRequest(resource: string, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const response = await fetch(`/api/relatorios/${resource}${query}`, { cache: "no-store",
    signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.erro || "Relatorio indisponivel");
  return result;
}
