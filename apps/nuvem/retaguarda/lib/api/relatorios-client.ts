import { browserApiRequest } from "./browser-client";

export async function reportsRequest(resource: string, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return browserApiRequest<any>(`/api/relatorios/${resource}${query}`, {
    timeoutMs: 15000, fallback: "Relatório indisponível",
  });
}
