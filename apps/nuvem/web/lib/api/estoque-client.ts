import { browserApiRequest } from "./browser-client";

export async function stockRequest(path: string, method = "GET", body?: unknown) {
  return browserApiRequest<any>(`/api/estoque${path}`, {
    method, body, fallback: "Estoque indisponível",
  });
}
