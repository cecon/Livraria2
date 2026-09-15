import { afterEach, beforeEach, expect, test, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("requisicao usa somente ponte local e propaga mensagem sanitizada", async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ erro: "Sessao expirada" }, 401));
  vi.stubGlobal("fetch", fetcher);
  const { stockRequest } = await import("../estoque-client");
  await expect(stockRequest("/ajustes", "POST", { qtd: 2 })).rejects.toThrow("Sessao expirada");
  expect(fetcher.mock.calls[0][0]).toBe("/api/estoque/ajustes");
  expect(fetcher.mock.calls[0][1].method).toBe("POST");
});
