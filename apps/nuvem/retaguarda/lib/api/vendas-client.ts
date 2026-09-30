import { browserApiRequest } from "./browser-client";

export async function salesRequest(path: string) {
  return browserApiRequest<any>(`/api/vendas${path}`, {
    method: "GET", timeoutMs: 15000, fallback: "Vendas indisponíveis",
  });
}
