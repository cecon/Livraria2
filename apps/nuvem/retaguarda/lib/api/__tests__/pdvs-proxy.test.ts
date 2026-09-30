import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocked = vi.hoisted(() => ({ token: "test", fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: () => mocked.token ? { value: mocked.token } : undefined,
}) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario",
  apiFetch: (...args: unknown[]) => mocked.fetcher(...args) }));
import { devicesProxy } from "../pdvs-proxy";

const uid = "11111111-1111-4111-8111-111111111111";
const request = (method = "GET", origin?: string, body?: object) => new NextRequest(
  `https://livraria.test/api/pdvs`, { method, ...(origin && { headers: {
    origin, "content-type": "application/json",
  } }), ...(body && { body: JSON.stringify(body) }) });

afterEach(() => { mocked.token = "test"; mocked.fetcher.mockReset(); });

test("maquinas sem sessao nao chamam API", async () => {
  mocked.token = "";
  expect((await devicesProxy(request())).status).toBe(401);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});

test("escrita exige mesma origem e rota permitida", async () => {
  expect((await devicesProxy(request("POST", "https://attacker.test"))).status).toBe(403);
  expect((await devicesProxy(request("DELETE", "https://livraria.test"), [uid])).status).toBe(400);
});

test("edicao e renovacao seguem somente rotas de maquinas", async () => {
  mocked.fetcher.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ atualizado: true }))));
  expect((await devicesProxy(request("PUT", "https://livraria.test", { nome: "Balcao" }), [uid])).status).toBe(200);
  expect(mocked.fetcher.mock.calls[0][0]).toBe(`pdvs/${uid}`);
  expect((await devicesProxy(request("POST", "https://livraria.test", {}), [uid, "token"])).status).toBe(200);
  expect(mocked.fetcher.mock.calls[1][0]).toBe(`pdvs/${uid}/token`);
});
