import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_COOKIE, apiFetch } from "./server";

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
  if (method === "GET") return path.length === 0 || (path.length === 1 && UUID.test(path[0]));
  if (method === "PUT") return path.length === 1 && UUID.test(path[0]);
  if (method === "DELETE" && path.length === 1 && UUID.test(path[0])) return true;
  if (method === "POST" && path.length === 0) return true;
  if (method === "POST" && path.length === 2 && UUID.test(path[0])) {
    return ["itens", "finalizacao", "cancelamento"].includes(path[1]);
  }
  return method === "DELETE" && path.length === 3 && UUID.test(path[0]) &&
    path[1] === "itens" && UUID.test(path[2]);
}

export async function entriesProxy(req: NextRequest, path: string[]) {
  if (!allowed(req.method, path)) return NextResponse.json({ erro: "Operacao invalida" }, { status: 400 });
  if (req.method !== "GET" && !sameOrigin(req)) {
    return NextResponse.json({ erro: "Origem invalida" }, { status: 403 });
  }
  if (!(await cookies()).get(API_COOKIE)?.value) {
    return NextResponse.json({ erro: "Sessao expirada. Entre novamente." }, { status: 401 });
  }
  try {
    const body = ["POST", "PUT"].includes(req.method) ? await req.text() : undefined;
    if (body && body.length > 20000) return NextResponse.json({ erro: "Dados excessivos" }, { status: 413 });
    const suffix = path.length ? `/${path.join("/")}` : "";
    const response = await apiFetch(`admin/lancamentos${suffix}`, { method: req.method, body });
    const result = await response.json();
    if (!response.ok) {
      const error = response.status === 401 ? "Sessao expirada. Entre novamente."
        : response.status === 403 ? "Esta operacao nao e permitida."
        : response.status === 404 ? "Lancamento, produto ou fornecedor nao localizado."
        : response.status === 409 ? "Este lancamento mudou. Recarregue e confira o status."
        : response.status === 400 ? "Confira os dados informados." : "Lancamentos indisponiveis.";
      return NextResponse.json({ erro: error }, { status: response.status });
    }
    return NextResponse.json(result, { status: response.status, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 });
  }
}
