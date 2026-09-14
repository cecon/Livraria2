import { afterEach, beforeEach, expect, test, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("modo legado e consultado sem ativacao automatica", async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ enabled: false }));
  vi.stubGlobal("fetch", fetcher);
  const { catalogApiEnabled } = await import("../catalogo-client");
  expect(await catalogApiEnabled()).toBe(false);
  expect(await catalogApiEnabled()).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("falha de configuracao nao aciona fallback e permite nova consulta", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(response({ enabled: true })));
  const { catalogApiEnabled } = await import("../catalogo-client");
  await expect(catalogApiEnabled()).rejects.toThrow("offline");
  expect(await catalogApiEnabled()).toBe(true);
});

test("le todas as paginas e ordena por titulo", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ items: [{ sync_uid: "1", titulo: "Z" }], next: "1" }))
    .mockResolvedValueOnce(response({ items: [{ sync_uid: "2", titulo: "A" }], next: null })));
  const { listApiBooks } = await import("../catalogo-client");
  expect((await listApiBooks()).map(book => book.titulo)).toEqual(["A", "Z"]);
});

test("cursor repetido e recusado sem loop", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response({ items: [], next: "same" }))));
  const { listApiBooks } = await import("../catalogo-client");
  await expect(listApiBooks()).rejects.toThrow("Cursor");
});

test("sessao expirada propaga mensagem sem gravar por outra via", async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ erro: "Sessao expirada" }, 401));
  vi.stubGlobal("fetch", fetcher);
  const { saveApiBook } = await import("../catalogo-client");
  expect(await saveApiBook({ sync_uid: "test", codigo: "503", titulo: "T", autor: "",
    descricao: "", categoria: 0, preco_centavos: 3100 })).toEqual({ error: "Sessao expirada" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1].method).toBe("PUT");
});
