import { browserApiRequest } from "./browser-client";

export async function salesRequest(path: string, method = "GET", body?: unknown) {
  return browserApiRequest<any>(`/api/vendas${path}`, {
    method, body, timeoutMs: 15000, fallback: "Vendas indisponíveis",
  });
}
