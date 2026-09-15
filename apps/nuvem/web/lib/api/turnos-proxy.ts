import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_COOKIE, apiFetch, shiftsApiEnabled } from "./server";

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
  if (method === "GET" && (path.length === 0 || (path.length === 1 && path[0] === "aberto"))) return true;
  if (method === "GET" && path.length === 2 && UUID.test(path[0]) && path[1] === "resumo") return true;
  if (method === "GET" && path.length === 3 && UUID.test(path[0]) &&
      path[1] === "pedidos" && path[2] === "contagem") return true;
  if (method === "POST" && path.length === 0) return true;
  return method === "POST" && path.length === 2 && UUID.test(path[0]) && path[1] === "encerramento";
}

export async function shiftsProxy(req: NextRequest, path: string[]) {
  if (!shiftsApiEnabled()) return NextResponse.json({ erro: "API desativada" }, { status: 503 });
  if (!allowed(req.method, path)) return NextResponse.json({ erro: "Operacao invalida" }, { status: 400 });
  if (req.method !== "GET" && !sameOrigin(req)) return NextResponse.json({ erro: "Origem invalida" }, { status: 403 });
  if (!(await cookies()).get(API_COOKIE)?.value) return NextResponse.json({ erro: "Sessao expirada." }, { status: 401 });
  try {
    const body = req.method === "POST" ? await req.text() : undefined;
    if (body && body.length > 10000) return NextResponse.json({ erro: "Dados excessivos" }, { status: 413 });
    const response = await apiFetch(`admin/turnos${path.length ? `/${path.join("/")}` : ""}`,
      { method: req.method, body });
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ erro: response.status === 409 ?
      "O turno mudou. Atualize a tela." : response.status === 400 ? "Confira os valores informados." :
      response.status === 401 ? "Sessao expirada." : "Turnos indisponiveis." }, { status: response.status });
    return NextResponse.json(result, { status: response.status, headers: { "cache-control": "no-store" } });
  } catch { return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 }); }
}
