import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocked = vi.hoisted(() => ({ login: vi.fn(), fetcher: vi.fn() }));
vi.mock("../server", () => ({
  apiLogin: (...args: unknown[]) => mocked.login(...args),
  apiFetch: (...args: unknown[]) => mocked.fetcher(...args),
}));
import { publicPdvProxy } from "../pdv-public-proxy";

const request = (path: string, method = "POST", body?: object, token?: string) => new NextRequest(
  `https://livraria.test/api/pdv/${path}`, { method,
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    ...(body && { body: JSON.stringify(body) }) });

afterEach(() => { mocked.login.mockReset(); mocked.fetcher.mockReset(); });

test("configura maquina existente sem devolver token humano", async () => {
  mocked.login.mockResolvedValue({ accessToken: "admin-token", user: { uid: "owner" } });
  mocked.fetcher
    .mockResolvedValueOnce(new Response(JSON.stringify([{
      uid: "11111111-1111-4111-8111-111111111111", nome: "PDV - CAIXA", ativo: true,
    }]), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ refreshToken: "refresh" }), { status: 200 }));
  const response = await publicPdvProxy(request("configurar", "POST", {
    nome: "PDV - CAIXA", usuario: "ADM", senha: "senha",
  }), ["configurar"]);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ uid: "11111111-1111-4111-8111-111111111111", refreshToken: "refresh" });
  expect(mocked.login).toHaveBeenCalledWith("adm", "senha");
  expect(mocked.fetcher.mock.calls[1][0]).toContain("/token");
});

test("catalogo exige credencial e limita consulta", async () => {
  expect((await publicPdvProxy(request("catalogo", "GET"), ["catalogo"])).status).toBe(401);
  mocked.fetcher.mockResolvedValue(new Response(JSON.stringify({ alteracoes: [] }), { status: 200 }));
  const authenticated = request("catalogo?cursor=2&limite=100", "GET", undefined, "a".repeat(30));
  expect((await publicPdvProxy(authenticated, ["catalogo"])).status).toBe(200);
  expect(mocked.fetcher.mock.calls[0][0]).toBe("sync/catalogo?cursor=2&limite=100");
});

test("nao transforma o proxy em acesso livre a API", async () => {
  expect((await publicPdvProxy(request("usuarios"), ["usuarios"])).status).toBe(404);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});
