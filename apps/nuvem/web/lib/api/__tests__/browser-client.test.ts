import { afterEach, expect, test, vi } from "vitest";
import { browserApiRequest } from "../browser-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("repete leitura depois de falha transitoria", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response({ erro: "reiniciando" }, 503))
    .mockResolvedValueOnce(response({ ok: true }));
  vi.stubGlobal("fetch", fetcher);

  const request = browserApiRequest<{ ok: boolean }>("/api/teste", { fallback: "Indisponível" });
  await vi.runAllTimersAsync();

  await expect(request).resolves.toEqual({ ok: true });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("nao repete escrita para evitar operacao duplicada", async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ erro: "reiniciando" }, 503));
  vi.stubGlobal("fetch", fetcher);

  await expect(browserApiRequest("/api/teste", {
    method: "POST", body: { valor: 1 }, fallback: "Indisponível",
  })).rejects.toThrow("reiniciando");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("sessao expirada mantem mensagem no ambiente sem navegador", async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ erro: "Sessão expirada" }, 401));
  vi.stubGlobal("fetch", fetcher);

  await expect(browserApiRequest("/api/teste", { fallback: "Indisponível" }))
    .rejects.toMatchObject({ message: "Sessão expirada", status: 401 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("sessao expirada limpa cookie e volta ao login preservando a pagina", async () => {
  const assign = vi.fn();
  vi.stubGlobal("window", { location: { pathname: "/venda", search: "?modo=rapido", assign } });
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response({ erro: "Sessão expirada" }, 401))
    .mockResolvedValueOnce(response({}, 200));
  vi.stubGlobal("fetch", fetcher);

  await expect(browserApiRequest("/api/teste", { fallback: "Indisponível" }))
    .rejects.toMatchObject({ status: 401 });
  expect(fetcher.mock.calls[1][0]).toBe("/api/logout");
  expect(assign).toHaveBeenCalledWith("/login?next=%2Fvenda%3Fmodo%3Drapido");
});
