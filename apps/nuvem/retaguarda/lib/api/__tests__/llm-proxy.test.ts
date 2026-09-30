import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mock = vi.hoisted(() => ({ token: "test-only", fetch: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mock.token ? { value: mock.token } : undefined }) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario", apiFetch: (...args: unknown[]) => mock.fetch(...args) }));
import { llmProxy } from "../llm-proxy";
import { publicPdvProxy } from "../pdv-public-proxy";

afterEach(() => { mock.token = "test-only"; mock.fetch.mockReset(); });
const uid = "11111111-1111-4111-8111-111111111111";
test("cadastro exige sessão e mesma origem", async () => {
  mock.token = "";
  expect((await llmProxy(new NextRequest("https://livraria.test/api/llms"))).status).toBe(401);
  mock.token = "test-only";
  expect((await llmProxy(new NextRequest("https://livraria.test/api/llms", { method: "POST", headers: { origin: "https://outro.test" } }))).status).toBe(403);
  expect(mock.fetch).not.toHaveBeenCalled();
});
test("rota de teste administrativa é restrita", async () => {
  const req = new NextRequest("https://livraria.test/api/llms", { method: "POST", headers: { origin: "https://livraria.test" } });
  expect((await llmProxy(req, [uid, "arbitrario"])).status).toBe(404);
  mock.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  expect((await llmProxy(req, [uid, "testar"])).status).toBe(200);
  expect(mock.fetch.mock.calls[0][0]).toBe(`admin/llms/${uid}/testar`);
});
test("PDV encaminha turno e bearer sem sessão administrativa", async () => {
  mock.fetch.mockResolvedValue(new Response("[]"));
  const token = "token-de-maquina-de-teste";
  const req = new NextRequest(`https://livraria.test/api/pdv/llms?turnoUid=${uid}`, { headers: { authorization: `Bearer ${token}` } });
  expect((await publicPdvProxy(req, ["llms"])).status).toBe(200);
  expect(mock.fetch.mock.calls[0][0]).toBe(`llms?turnoUid=${uid}`);
  expect(mock.fetch.mock.calls[0][2]).toBe(token);
  expect((await publicPdvProxy(new NextRequest("https://livraria.test/api/pdv/llms?turnoUid=outro"), ["llms"])).status).toBe(400);
});
