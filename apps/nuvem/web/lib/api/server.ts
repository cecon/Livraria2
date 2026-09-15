import "server-only";
import { cookies } from "next/headers";
import { apiOnlyMode, apiOrigin } from "./config";

export const API_COOKIE = "nuvem_usuario";
export { apiOnlyMode };
export const catalogApiEnabled = () => apiOnlyMode() || process.env.API_CATALOGO_ENABLED === "true";
export const referencesApiEnabled = () => apiOnlyMode() || process.env.API_REFERENCIAS_ENABLED === "true";
export const usersApiEnabled = () => apiOnlyMode() || process.env.API_USUARIOS_ENABLED === "true";
export const pdvStatusApiEnabled = () => apiOnlyMode() || process.env.API_PDV_STATUS_ENABLED === "true";
export const stockApiEnabled = () => apiOnlyMode() || process.env.API_ESTOQUE_ENABLED === "true";
export const entriesApiEnabled = () => apiOnlyMode() || process.env.API_LANCAMENTOS_ENABLED === "true";
export const shiftsApiEnabled = () => apiOnlyMode() || process.env.API_TURNOS_ENABLED === "true";
export const salesApiEnabled = () => apiOnlyMode() || process.env.API_VENDAS_ENABLED === "true";
export const reportsApiEnabled = () => apiOnlyMode() || process.env.API_RELATORIOS_ENABLED === "true";
export const userApiEnabled = () => catalogApiEnabled() || referencesApiEnabled() ||
  usersApiEnabled() || pdvStatusApiEnabled() || stockApiEnabled() || entriesApiEnabled() ||
  shiftsApiEnabled() || salesApiEnabled() || reportsApiEnabled();

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
