import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocked = vi.hoisted(() => ({ enabled: true, token: "test-only", fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: () => mocked.token ? { value: mocked.token } : undefined,
}) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario", entriesApiEnabled: () => mocked.enabled,
  apiFetch: (...args: unknown[]) => mocked.fetcher(...args) }));
import { entriesProxy } from "../lancamentos-proxy";

const uid = "11111111-1111-4111-8111-111111111111";
afterEach(() => { mocked.enabled = true; mocked.token = "test-only"; mocked.fetcher.mockReset(); });
const request = (method = "GET", path = "", origin?: string) =>
  new NextRequest(`https://livraria.test/api/lancamentos${path}`, {
    method, ...(origin && { headers: { origin } }),
  });

test("proxy aceita somente rotas declaradas", async () => {
  expect((await entriesProxy(request("GET", "/segredo"), ["segredo"])).status).toBe(400);
  expect((await entriesProxy(request("DELETE", `/${uid}/itens/${uid}`, "https://attacker.test"),
    [uid, "itens", uid])).status).toBe(403);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});

test("proxy encaminha remocao de item e sanitiza falhas", async () => {
  mocked.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ excluido: true })));
  const response = await entriesProxy(request("DELETE", `/${uid}/itens/${uid}`, "https://livraria.test"),
    [uid, "itens", uid]);
  expect(response.status).toBe(200);
  expect(mocked.fetcher.mock.calls[0][0]).toBe(`admin/lancamentos/${uid}/itens/${uid}`);
  mocked.fetcher.mockRejectedValueOnce(new Error("database-secret"));
  const failed = await entriesProxy(request(), []);
  expect(await failed.text()).not.toContain("database-secret");
});

test("modo desligado e sessao ausente nao chegam a API", async () => {
  mocked.enabled = false;
  expect((await entriesProxy(request(), [])).status).toBe(503);
  mocked.enabled = true;
  mocked.token = "";
  expect((await entriesProxy(request(), [])).status).toBe(401);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});
