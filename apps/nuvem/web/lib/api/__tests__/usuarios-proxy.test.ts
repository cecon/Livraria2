import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocked = vi.hoisted(() => ({ token: "test-only", fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocked.token ? { value: mocked.token } : undefined }) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario",
  apiFetch: (...args: unknown[]) => mocked.fetcher(...args) }));
import { usersProxy } from "../usuarios-proxy";

afterEach(() => { mocked.token = "test-only"; mocked.fetcher.mockReset(); });
const request = (method = "GET", origin?: string) => new NextRequest("https://livraria.test/api/usuarios", {
  method, ...(origin && { headers: { origin } }),
});

test("usuarios sem sessao nao chamam API", async () => {
  mocked.token = "";
  expect((await usersProxy(request())).status).toBe(401);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});

test("escrita exige mesma origem e identificador canonico", async () => {
  expect((await usersProxy(request("POST", "https://attacker.test"))).status).toBe(403);
  expect((await usersProxy(request("PATCH", "https://livraria.test"), "Pessoa Teste", undefined, {})).status).toBe(400);
});

test("acao permitida encaminha somente rota administrativa", async () => {
  mocked.fetcher.mockResolvedValue(new Response(JSON.stringify({ atualizado: true })));
  const response = await usersProxy(request("POST", "https://livraria.test"), "pessoa.teste", "ativa", { ativa: false });
  expect(response.status).toBe(200);
  expect(mocked.fetcher.mock.calls[0][0]).toBe("admin/usuarios/pessoa.teste/ativa");
});
