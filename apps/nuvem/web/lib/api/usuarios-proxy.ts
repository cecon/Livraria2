import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_COOKIE, apiFetch, usersApiEnabled } from "./server";

function sameOrigin(req: NextRequest) {
  try {
    const origin = new URL(req.headers.get("origin") || "");
    const host = req.headers.get("host") || req.nextUrl.host;
    const forwarded = req.headers.get("x-forwarded-proto");
    const protocol = forwarded === "https" || forwarded === "http" ? `${forwarded}:` : req.nextUrl.protocol;
    return origin.host.toLowerCase() === host.toLowerCase() && origin.protocol === protocol;
  } catch { return false; }
}

export async function usersProxy(req: NextRequest, id?: string, action?: "senha" | "ativa", body?: unknown) {
  if (!usersApiEnabled()) return NextResponse.json({ erro: "API desativada" }, { status: 503 });
  if (id && !/^[a-z0-9._-]{1,100}$/.test(id)) return NextResponse.json({ erro: "Usuario invalido" }, { status: 400 });
  if (req.method !== "GET" && !sameOrigin(req)) return NextResponse.json({ erro: "Origem invalida" }, { status: 403 });
  if (!(await cookies()).get(API_COOKIE)?.value) {
    return NextResponse.json({ erro: "Sessao expirada. Entre novamente." }, { status: 401 });
  }
  try {
    const payload = body === undefined && req.method !== "GET" ? await req.text() :
      body === undefined ? undefined : JSON.stringify(body);
    if (payload && payload.length > 20000) return NextResponse.json({ erro: "Dados excessivos" }, { status: 413 });
    const suffix = id ? `/${encodeURIComponent(id)}${action ? `/${action}` : ""}` : "";
    const response = await apiFetch(`admin/usuarios${suffix}`,
      { method: req.method === "PATCH" ? "PUT" : req.method, body: payload });
    const result = await response.json();
    if (!response.ok) {
      const erro = response.status === 401 ? "Sessao expirada. Entre novamente."
        : response.status === 409 ? "Operacao recusada: confira duplicidade ou o ultimo administrador."
        : response.status === 400 ? "Confira os dados informados."
        : response.status === 403 ? "Sem permissao." : "Gestao de usuarios indisponivel.";
      return NextResponse.json({ erro }, { status: response.status });
    }
    return NextResponse.json(result, { status: response.status });
  } catch {
    return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 });
  }
}
