import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_COOKIE, apiFetch } from "./server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sameOrigin(req: NextRequest) {
  try {
    const origin = new URL(req.headers.get("origin") || "");
    const forwarded = req.headers.get("x-forwarded-proto");
    const protocol = forwarded === "https" || forwarded === "http" ? `${forwarded}:` : req.nextUrl.protocol;
    return origin.host.toLowerCase() === (req.headers.get("host") || req.nextUrl.host).toLowerCase() &&
      origin.protocol === protocol;
  } catch { return false; }
}

function allowed(method: string, path: string[]) {
  if (method === "GET" && path.length === 0) return true;
  if (method === "POST" && path.length === 0) return true;
  if (method === "PUT" && path.length === 1 && UUID.test(path[0])) return true;
  return method === "POST" && path.length === 2 && UUID.test(path[0]) &&
    (path[1] === "token" || path[1] === "desativar");
}

export async function devicesProxy(req: NextRequest, path: string[] = []) {
  if (!allowed(req.method, path)) return NextResponse.json({ erro: "Operacao invalida." }, { status: 400 });
  if (req.method !== "GET" && !sameOrigin(req)) {
    return NextResponse.json({ erro: "Origem invalida." }, { status: 403 });
  }
  if (!(await cookies()).get(API_COOKIE)?.value) {
    return NextResponse.json({ erro: "Sessao expirada. Entre novamente." }, { status: 401 });
  }
  try {
    const body = req.method === "GET" ? undefined : await req.text();
    if (body && body.length > 10000) return NextResponse.json({ erro: "Dados excessivos." }, { status: 413 });
    const response = await apiFetch(`pdvs${path.length ? `/${path.join("/")}` : ""}`,
      { method: req.method, body });
    const responseBody = await response.text();
    const result = responseBody ? JSON.parse(responseBody) : null;
    if (!response.ok) {
      const erro = response.status === 400 ? "Confira os dados informados." :
        response.status === 401 ? "Sessao expirada. Entre novamente." :
        response.status === 403 ? "Sem permissao." :
        response.status === 404 ? "Maquina nao encontrada." : "Gestao de maquinas indisponivel.";
      return NextResponse.json({ erro }, { status: response.status });
    }
    return NextResponse.json(result, { status: response.status, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 });
  }
}
