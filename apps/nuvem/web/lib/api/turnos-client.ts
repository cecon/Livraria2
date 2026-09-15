import { browserApiRequest } from "./browser-client";

export async function shiftsRequest(path: string, method = "GET", body?: unknown) {
  return browserApiRequest<any>(`/api/turnos${path}`, {
    method, body, fallback: "Turnos indisponíveis",
  });
}
