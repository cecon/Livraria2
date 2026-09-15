import "server-only";
import { cookies } from "next/headers";

export const API_COOKIE = "nuvem_usuario";
export const catalogApiEnabled = () => process.env.API_CATALOGO_ENABLED === "true";
export const referencesApiEnabled = () => process.env.API_REFERENCIAS_ENABLED === "true";
export const usersApiEnabled = () => process.env.API_USUARIOS_ENABLED === "true";
export const pdvStatusApiEnabled = () => process.env.API_PDV_STATUS_ENABLED === "true";
export const stockApiEnabled = () => process.env.API_ESTOQUE_ENABLED === "true";
export const userApiEnabled = () => catalogApiEnabled() || referencesApiEnabled() ||
  usersApiEnabled() || pdvStatusApiEnabled() || stockApiEnabled();

export async function apiFetch(path: string, init: RequestInit = {}, token?: string) {
  const value = process.env.NUVEM_API_URL;
  if (!value) throw new Error("API nao configurada");
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/') throw new Error("Origem API invalida");
  const credential = token ?? (await cookies()).get(API_COOKIE)?.value;
  return fetch(`${url.origin}/api/v1/${path}`, {
    ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5000),
    headers: { "content-type": "application/json", ...(credential && { authorization: `Bearer ${credential}` }) },
  });
}

export async function apiLogin(usuario: string, senha: string) {
  const response = await apiFetch("auth/login", { method: "POST", body: JSON.stringify({ usuario, senha }) });
  if (!response.ok) throw new Error("Autenticacao API indisponivel");
  const body = await response.json();
  if (typeof body.accessToken !== "string" || body.expiresIn !== 900) throw new Error("Sessao API invalida");
  const me = await apiFetch("auth/me", {}, body.accessToken);
  if (!me.ok) throw new Error("Perfil API indisponivel");
  const user = await me.json();
  if (user.tipo !== "usuario" || user.perfil !== "admin") throw new Error("Perfil sem acesso");
  return body.accessToken as string;
}
