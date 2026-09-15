import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocked = vi.hoisted(() => ({ enabled: true, token: "test-only", fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocked.token ? { value: mocked.token } : undefined }) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario", referencesApiEnabled: () => mocked.enabled,
  apiFetch: (...args: unknown[]) => mocked.fetcher(...args) }));
import { referencesProxy } from "../referencias-proxy";

afterEach(() => { mocked.enabled = true; mocked.token = "test-only"; mocked.fetcher.mockReset(); });
const request = (method = "GET", path = "formas", origin?: string) =>
  new NextRequest(`https://livraria.test/api/referencias/${path}`, {
    method, ...(origin && { headers: { origin } }),
  });

test("proxy desligado nao chama API", async () => {
  mocked.enabled = false;
  expect((await referencesProxy(request(), "formas")).status).toBe(503);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});

test("mutacao exige mesma origem e sessao individual", async () => {
  expect((await referencesProxy(request("POST", "formas", "https://attacker.test"), "formas")).status).toBe(403);
  mocked.token = "";
  expect((await referencesProxy(request(), "formas")).status).toBe(401);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});

test("acao e UUID sao validados antes da API", async () => {
  expect((await referencesProxy(request("PUT", "formas/x/ativa", "https://livraria.test"),
    "formas", "x", "ativa")).status).toBe(400);
  expect((await referencesProxy(request("PUT", "fornecedores/reordenar", "https://livraria.test"),
    "fornecedores", undefined, "reordenar")).status).toBe(400);
});

test("reordenacao usa apenas endpoint permitido e nao revela falha", async () => {
  mocked.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ atualizado: true })));
  const response = await referencesProxy(request("PUT", "formas/reordenar", "https://livraria.test"),
    "formas", undefined, "reordenar");
  expect(response.status).toBe(200);
  expect(mocked.fetcher.mock.calls[0][0]).toBe("admin/formas/reordenar");
  mocked.fetcher.mockRejectedValueOnce(new Error("token-secret"));
  const failed = await referencesProxy(request(), "formas");
  expect(await failed.text()).not.toContain("token-secret");
});
