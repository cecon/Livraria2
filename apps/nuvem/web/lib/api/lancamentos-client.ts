import { browserApiRequest } from "./browser-client";

export async function entriesRequest(path: string, method = "GET", body?: unknown) {
  return browserApiRequest<any>(`/api/lancamentos${path}`, {
    method, body, fallback: "Lançamentos indisponíveis",
  });
}
