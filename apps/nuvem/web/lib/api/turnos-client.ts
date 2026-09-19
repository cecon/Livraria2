import { browserApiRequest } from "./browser-client";

export async function shiftsRequest(path: string) {
  return browserApiRequest<any>(`/api/turnos${path}`, {
    method: "GET", fallback: "Turnos indisponíveis",
  });
}
