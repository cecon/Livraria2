import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const mocked = vi.hoisted(() => ({ enabled: true, token: "test", fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocked.token ? { value: mocked.token } : undefined }) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario", salesApiEnabled: () => mocked.enabled,
  apiFetch: (...args: unknown[]) => mocked.fetcher(...args) }));
import { salesProxy } from "../vendas-proxy";
afterEach(() => { mocked.enabled = true; mocked.token = "test"; mocked.fetcher.mockReset(); });
const request = (method: string, path = "", origin?: string) => new NextRequest(
  `https://livraria.test/api/vendas${path}`, { method, ...(origin && { headers: { origin } }) });

test("venda exige mesma origem e lista somente hoje", async () => {
  expect((await salesProxy(request("POST", "", "https://attacker.test"), [])).status).toBe(403);
  expect((await salesProxy(request("GET", "/todas"), ["todas"])).status).toBe(400);
  mocked.fetcher.mockResolvedValueOnce(new Response(JSON.stringify([])));
  expect((await salesProxy(request("GET", "/hoje"), ["hoje"])).status).toBe(200);
  expect(mocked.fetcher.mock.calls[0][0]).toBe("admin/vendas/hoje");
});
