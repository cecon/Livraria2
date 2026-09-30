import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const mocked = vi.hoisted(() => ({ token: "test", fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocked.token ? { value: mocked.token } : undefined }) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario",
  apiFetch: (...args: unknown[]) => mocked.fetcher(...args) }));
import { shiftsProxy } from "../turnos-proxy";
afterEach(() => { mocked.token = "test"; mocked.fetcher.mockReset(); });
const request = (method = "GET", path = "", origin?: string) => new NextRequest(
  `https://livraria.test/api/turnos${path}`, { method, ...(origin && { headers: { origin } }) });

test("escritorio nao pode operar turnos", async () => {
  expect((await shiftsProxy(request("GET", "/segredo"), ["segredo"])).status).toBe(405);
  expect((await shiftsProxy(request("POST", "", "https://livraria.test"), [])).status).toBe(405);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});

test("consulta turnos dos PDVs pela API interna", async () => {
  mocked.fetcher.mockResolvedValueOnce(new Response(JSON.stringify([])));
  const response = await shiftsProxy(request("GET"), []);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
  expect(mocked.fetcher.mock.calls[0][0]).toBe("admin/turnos");
});
