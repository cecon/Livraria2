import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocked = vi.hoisted(() => ({ enabled: true, token: "test-only", fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: () => mocked.token ? { value: mocked.token } : undefined,
}) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario", stockApiEnabled: () => mocked.enabled,
  apiFetch: (...args: unknown[]) => mocked.fetcher(...args) }));
import { stockProxy } from "../estoque-proxy";

afterEach(() => { mocked.enabled = true; mocked.token = "test-only"; mocked.fetcher.mockReset(); });
const request = (method = "GET", path = "saldos", origin?: string) =>
  new NextRequest(`https://livraria.test/api/estoque/${path}`, {
    method, ...(origin && { headers: { origin } }),
  });

test("proxy bloqueia modo desligado, rota livre e origem externa", async () => {
  mocked.enabled = false;
  expect((await stockProxy(request(), ["saldos"])).status).toBe(503);
  mocked.enabled = true;
  expect((await stockProxy(request("GET", "segredo"), ["segredo"])).status).toBe(400);
  expect((await stockProxy(request("POST", "ajustes", "https://attacker.test"), ["ajustes"])).status).toBe(403);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});

test("proxy exige sessao e encaminha apenas caminho permitido", async () => {
  mocked.token = "";
  expect((await stockProxy(request(), ["saldos"])).status).toBe(401);
  mocked.token = "test-only";
  mocked.fetcher.mockResolvedValueOnce(new Response(JSON.stringify([{ livro_uid: "x", saldo: 2 }])));
  const response = await stockProxy(request(), ["saldos"]);
  expect(response.status).toBe(200);
  expect(mocked.fetcher.mock.calls[0][0]).toBe("admin/estoque/saldos");
});

test("mutacao aceita mesma origem e nao revela erro interno", async () => {
  mocked.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ registrado: true }), { status: 201 }));
  expect((await stockProxy(request("POST", "ajustes", "https://livraria.test"), ["ajustes"])).status).toBe(201);
  mocked.fetcher.mockRejectedValueOnce(new Error("token-secret"));
  const failed = await stockProxy(request(), ["saldos"]);
  expect(await failed.text()).not.toContain("token-secret");
});
