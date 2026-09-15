import { afterEach, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { apiOrigin } from "../config";
import { updateSession } from "../../../utils/session/middleware";

const previous = { ...process.env };

afterEach(() => {
  process.env = { ...previous };
});

test("origem da API rejeita URL com credencial ou caminho", () => {
  process.env.NUVEM_API_URL = "https://usuario:senha@api.test/interno";
  expect(() => apiOrigin()).toThrow("Origem API invalida");
});

test("middleware libera tela com cookie de sessao sem chamada adicional", async () => {
  const request = new NextRequest("https://livraria.test/cadastro", {
    headers: { cookie: "nuvem_usuario=token-individual" },
  });
  expect((await updateSession(request)).status).toBe(200);
});

test("middleware redireciona quando o cookie esta ausente", async () => {
  process.env.NUVEM_API_URL = "https://api.test";
  const missing = await updateSession(new NextRequest("https://livraria.test/cadastro"));
  expect(missing.status).toBe(307);
  expect(missing.headers.get("location")).toBe("https://livraria.test/login");
});
