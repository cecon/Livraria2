import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_COOKIE, apiFetch, stockApiEnabled } from "./server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sameOrigin(req: NextRequest) {
  try {
    const origin = new URL(req.headers.get("origin") || "");
    const host = req.headers.get("host") || req.nextUrl.host;
    const forwarded = req.headers.get("x-forwarded-proto");
    const protocol = forwarded === "https" || forwarded === "http" ? `${forwarded}:` : req.nextUrl.protocol;
    return origin.host.toLowerCase() === host.toLowerCase() && origin.protocol === protocol;
  } catch { return false; }
}

function allowed(method: string, path: string[]) {
  if (method === "GET" && path.length === 1 && ["saldos", "divergencias"].includes(path[0])) return true;
  if (method === "GET" && path.length === 3 && path[0] === "livros" &&
      UUID.test(path[1]) && path[2] === "movimentos") return true;
  if (method === "POST" && path.length === 1 && ["ajustes", "contagens"].includes(path[0])) return true;
  return method === "PUT" && path.length === 2 && path[0] === "divergencias" && UUID.test(path[1]);
}

export async function stockProxy(req: NextRequest, path: string[]) {
  if (!stockApiEnabled()) return NextResponse.json({ erro: "API desativada" }, { status: 503 });
  if (!allowed(req.method, path)) return NextResponse.json({ erro: "Operacao invalida" }, { status: 400 });
  if (req.method !== "GET" && !sameOrigin(req)) {
    return NextResponse.json({ erro: "Origem invalida" }, { status: 403 });
  }
  if (!(await cookies()).get(API_COOKIE)?.value) {
    return NextResponse.json({ erro: "Sessao expirada. Entre novamente." }, { status: 401 });
  }
  try {
    const body = req.method === "GET" ? undefined : await req.text();
    if (body && body.length > 100000) return NextResponse.json({ erro: "Dados excessivos" }, { status: 413 });
    const response = await apiFetch(`admin/estoque/${path.join("/")}`, { method: req.method, body });
    const result = await response.json();
    if (!response.ok) {
      const error = response.status === 401 ? "Sessao expirada. Entre novamente."
        : response.status === 403 ? "Esta operacao nao e permitida."
        : response.status === 404 ? "Produto ou divergencia nao localizado."
        : response.status === 409 ? "Os dados mudaram. Recarregue e tente novamente."
        : response.status === 400 ? "Confira os dados informados." : "Estoque indisponivel.";
      return NextResponse.json({ erro: error }, { status: response.status });
    }
    return NextResponse.json(result, { status: response.status, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 });
  }
}
