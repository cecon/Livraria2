import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const mocked = vi.hoisted(() => ({ token: "test", fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocked.token ? { value: mocked.token } : undefined }) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario",
  apiFetch: (...args: unknown[]) => mocked.fetcher(...args) }));
import { shiftsProxy } from "../turnos-proxy";
const uid = "11111111-1111-4111-8111-111111111111";
afterEach(() => { mocked.token = "test"; mocked.fetcher.mockReset(); });
const request = (method = "GET", path = "", origin?: string) => new NextRequest(
  `https://livraria.test/api/turnos${path}`, { method, ...(origin && { headers: { origin } }) });

test("turnos recusam rotas e origens nao permitidas", async () => {
  expect((await shiftsProxy(request("GET", "/segredo"), ["segredo"])).status).toBe(400);
  expect((await shiftsProxy(request("POST", `/${uid}/encerramento`, "https://attacker.test"),
    [uid, "encerramento"])).status).toBe(403);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});

test("resumo permitido passa somente pela API interna", async () => {
  mocked.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ qtdVendas: 0 })));
  expect((await shiftsProxy(request("GET", `/${uid}/resumo`), [uid, "resumo"])).status).toBe(200);
  expect(mocked.fetcher.mock.calls[0][0]).toBe(`admin/turnos/${uid}/resumo`);
});
