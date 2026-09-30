import { afterEach, beforeEach, expect, test, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("formas percorrem paginas e respeitam ordem administrativa", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(response({ items: [{ sync_uid: "1", rotulo: "Z", ordem: 2 }], next: "1" }))
    .mockResolvedValueOnce(response({ items: [{ sync_uid: "2", rotulo: "A", ordem: 0 }], next: null })));
  const { listApiForms } = await import("../referencias-client");
  expect((await listApiForms()).map(form => form.rotulo)).toEqual(["A", "Z"]);
});

test("cursor repetido e recusado e erro de escrita e devolvido a tela", async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response({ items: [], next: "same" })));
  vi.stubGlobal("fetch", fetcher);
  const { listApiSuppliers, saveApiSupplier } = await import("../referencias-client");
  await expect(listApiSuppliers()).rejects.toThrow("Cursor");
  fetcher.mockResolvedValueOnce(response({ erro: "Sessao expirada" }, 401));
  expect(await saveApiSupplier({ sync_uid: "id", nome: "Teste" })).toEqual({ error: "Sessao expirada" });
});

test("reordenacao envia somente os UUIDs na ordem exibida", async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ atualizado: true }));
  vi.stubGlobal("fetch", fetcher);
  const { reorderApiForms } = await import("../referencias-client");
  const forma = (sync_uid: string) => ({ sync_uid, chave: sync_uid, rotulo: sync_uid,
    de_sistema: false, ativa: true, ordem: 0 });
  expect(await reorderApiForms([forma("b"), forma("a")])).toEqual({});
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ uids: ["b", "a"] });
});
