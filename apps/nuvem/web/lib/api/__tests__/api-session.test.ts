import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { apiFeaturesEnabled, apiOnlyMode, apiOrigin } from "../config";
import { updateSession } from "../../../utils/supabase/middleware";

const previous = { ...process.env };

afterEach(() => {
  process.env = { ...previous };
  vi.unstubAllGlobals();
});

test("modo API ativa todos os fluxos com uma unica chave", () => {
  process.env.API_ONLY_MODE = "true";
  delete process.env.API_CATALOGO_ENABLED;
  expect(apiOnlyMode()).toBe(true);
  expect(apiFeaturesEnabled()).toBe(true);
});

test("origem da API rejeita URL com credencial ou caminho", () => {
  process.env.NUVEM_API_URL = "https://usuario:senha@api.test/interno";
  expect(() => apiOrigin()).toThrow("Origem API invalida");
});

test("middleware API-only valida token antes de liberar tela", async () => {
  process.env.API_ONLY_MODE = "true";
  process.env.NUVEM_API_URL = "https://api.test";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    uid: "00000000-0000-0000-0000-000000000001", usuario: "admin",
    nome: "Admin", perfil: "admin", tipo: "usuario",
  })));
  vi.stubGlobal("fetch", fetcher);
  const request = new NextRequest("https://livraria.test/cadastro", {
    headers: { cookie: "nuvem_usuario=token-individual" },
  });
  expect((await updateSession(request)).status).toBe(200);
  expect(fetcher).toHaveBeenCalledWith("https://api.test/api/v1/auth/me",
    expect.objectContaining({ headers: { authorization: "Bearer token-individual" } }));
});

test("middleware API-only redireciona token ausente ou recusado", async () => {
  process.env.API_ONLY_MODE = "true";
  process.env.NUVEM_API_URL = "https://api.test";
  const missing = await updateSession(new NextRequest("https://livraria.test/cadastro"));
  expect(missing.status).toBe(307);
  expect(missing.headers.get("location")).toBe("https://livraria.test/login");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
  const denied = await updateSession(new NextRequest("https://livraria.test/cadastro", {
    headers: { cookie: "nuvem_usuario=expirado" },
  }));
  expect(denied.status).toBe(307);
});
