import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const mocked = vi.hoisted(() => ({ token: "test", fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocked.token ? { value: mocked.token } : undefined }) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario",
  apiFetch: (...args: unknown[]) => mocked.fetcher(...args) }));
import { salesProxy } from "../vendas-proxy";
afterEach(() => { mocked.token = "test"; mocked.fetcher.mockReset(); });
const request = (method: string, path = "", origin?: string) => new NextRequest(
  `https://livraria.test/api/vendas${path}`, { method, ...(origin && { headers: { origin } }) });

test("online bloqueia criacao de venda e permite consulta de hoje", async () => {
  expect((await salesProxy(request("POST", "", "https://livraria.test"), [])).status).toBe(405);
  expect((await salesProxy(request("GET", "/todas"), ["todas"])).status).toBe(405);
  expect(mocked.fetcher).not.toHaveBeenCalled();
  mocked.fetcher.mockResolvedValueOnce(new Response(JSON.stringify([])));
  expect((await salesProxy(request("GET", "/hoje"), ["hoje"])).status).toBe(200);
  expect(mocked.fetcher.mock.calls[0][0]).toBe("admin/vendas/hoje");
});
