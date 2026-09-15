import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const mocked = vi.hoisted(() => ({ token: "test", fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocked.token ? { value: mocked.token } : undefined }) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario",
  apiFetch: (...args: unknown[]) => mocked.fetcher(...args) }));
import { reportsProxy } from "../relatorios-proxy";
afterEach(() => { mocked.token = "test"; mocked.fetcher.mockReset(); });

test("relatorios aceitam somente recursos e filtros declarados", async () => {
  const invalid = new NextRequest("https://livraria.test/api/relatorios/vendas?data=2026-09-15");
  expect((await reportsProxy(invalid, "vendas")).status).toBe(400);
  const secret = new NextRequest("https://livraria.test/api/relatorios/segredo");
  expect((await reportsProxy(secret, "segredo")).status).toBe(400);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});

test("filtros validados sao encaminhados sem dados extras", async () => {
  mocked.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ pedidos: [] })));
  const request = new NextRequest("https://livraria.test/api/relatorios/vendas?data=2026-09-15&periodo=dia");
  expect((await reportsProxy(request, "vendas")).status).toBe(200);
  expect(mocked.fetcher.mock.calls[0][0]).toBe("admin/relatorios/vendas?data=2026-09-15&periodo=dia");
});
