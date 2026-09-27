import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const mocked = vi.hoisted(() => ({ token: "test-only", fetcher: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocked.token ? { value: mocked.token } : undefined }) }));
vi.mock("../server", () => ({ API_COOKIE: "nuvem_usuario", apiFetch: (...args: unknown[]) => mocked.fetcher(...args) }));
import { imageUploadProxy } from "../image-upload-proxy";
afterEach(() => { mocked.token = "test-only"; mocked.fetcher.mockReset(); });
const request = (origin = "https://livraria.test", body = '{"imagem":"teste"}') => new NextRequest("https://livraria.test/api/imagens", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body,
});
test("upload exige origem e sessao, PDV usa apenas token explicito", async () => {
  expect((await imageUploadProxy(request("https://externo.test"))).status).toBe(403);
  mocked.token = "";
  expect((await imageUploadProxy(request())).status).toBe(401);
  expect(mocked.fetcher).not.toHaveBeenCalled();
  mocked.fetcher.mockResolvedValue(new Response('{"uid":"imagem"}', { status: 201 }));
  expect((await imageUploadProxy(request(""), "pdv-token")).status).toBe(201);
  expect(mocked.fetcher.mock.calls[0][2]).toBe("pdv-token");
});
test("limite e aplicado enquanto le o corpo, antes de acessar API", async () => {
  expect((await imageUploadProxy(request(undefined, "x".repeat(7_000_001)))).status).toBe(413);
  expect(mocked.fetcher).not.toHaveBeenCalled();
});
test("erro de formato volta ao formulario e falha de rede nao revela segredo", async () => {
  mocked.fetcher.mockResolvedValueOnce(new Response('{"message":"Imagem inválida"}', { status: 400 }));
  expect(await (await imageUploadProxy(request())).json()).toEqual({ erro: "Imagem inválida" });
  mocked.fetcher.mockRejectedValueOnce(new Error("secret-test"));
  const r = await imageUploadProxy(request());
  expect(r.status).toBe(502); expect(await r.text()).not.toContain("secret-test");
});
