import "server-only";
import { cookies } from "next/headers";
import { apiOrigin } from "./config";

export const API_COOKIE = "nuvem_usuario";

export async function apiFetch(path: string, init: RequestInit = {}, token?: string) {
  const credential = token ?? (await cookies()).get(API_COOKIE)?.value;
  return fetch(`${apiOrigin()}/api/v1/${path}`, {
    ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5000),
    headers: { "content-type": "application/json", ...(credential && { authorization: `Bearer ${credential}` }) },
  });
}

export async function apiLogin(usuario: string, senha: string) {
  const response = await apiFetch("auth/login", { method: "POST", body: JSON.stringify({ usuario, senha }) });
  if (!response.ok) throw new Error("Autenticacao API indisponivel");
  const body = await response.json();
  if (typeof body.accessToken !== "string" || body.expiresIn !== 28800) throw new Error("Sessao API invalida");
  const me = await apiFetch("auth/me", {}, body.accessToken);
  if (!me.ok) throw new Error("Perfil API indisponivel");
  const user = await me.json();
  if (user.tipo !== "usuario" || user.perfil !== "admin" ||
      typeof user.uid !== "string" || !/^[0-9a-f-]{36}$/i.test(user.uid) ||
      typeof user.usuario !== "string" || !user.usuario) throw new Error("Perfil sem acesso");
  return { accessToken: body.accessToken as string, user: {
    uid: String(user.uid), usuario: String(user.usuario), nome: user.nome == null ? null : String(user.nome),
    perfil: user.perfil as "admin", tipo: "usuario" as const,
  }, expiresIn: body.expiresIn as number };
}
