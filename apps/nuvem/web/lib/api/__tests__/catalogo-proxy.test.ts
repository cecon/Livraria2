import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocked = vi.hoisted(() => ({ enabled: true, token: "test-only", fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocked.token ? { value: mocked.token } : undefined }) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario", catalogApiEnabled: () => mocked.enabled,
  apiFetch: (...args: unknown[]) => mocked.fetcher(...args) }));
import { catalogProxy } from "../catalogo-proxy";

afterEach(() => { mocked.enabled = true; mocked.token = "test-only"; mocked.fetcher.mockReset(); });
const request = (method = "GET", origin?: string) => new NextRequest("https://livraria.test/api/catalogo", {
  method, ...(origin && { headers: { origin } }),
});

test("proxy desativado nunca chama API", async () => {
  mocked.enabled = false;
  expect((await catalogProxy(request())).status).toBe(503);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});

test("mutacoes recusam origem externa ou ausente", async () => {
  expect((await catalogProxy(request("POST", "https://attacker.test"))).status).toBe(403);
  expect((await catalogProxy(request("DELETE"), "00000000-0000-0000-0000-000000000000")).status).toBe(403);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});

test("sem cookie individual nao usa sessao compartilhada", async () => {
  mocked.token = "";
  expect((await catalogProxy(request())).status).toBe(401);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});

test("respostas da API sao repassadas sem token ou cache", async () => {
  mocked.fetcher.mockResolvedValue(new Response(JSON.stringify({ items: [], next: null })));
  const response = await catalogProxy(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ items: [], next: null });
});

test("falha da API devolve erro controlado sem revelar segredo", async () => {
  mocked.fetcher.mockRejectedValue(new Error("token-secret"));
  const response = await catalogProxy(request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("token-secret");
});

test("origem usa Host real mesmo quando Next normaliza a URL interna", async () => {
  mocked.fetcher.mockResolvedValue(new Response(JSON.stringify({ sync_uid: "test" }), { status: 201 }));
  const proxied = new NextRequest("http://localhost:3004/api/catalogo", {
    method: "POST", headers: { host: "livraria.test", origin: "https://livraria.test", "x-forwarded-proto": "https" },
  });
  expect((await catalogProxy(proxied)).status).toBe(201);
});
