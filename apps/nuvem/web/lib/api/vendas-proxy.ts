import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_COOKIE, apiFetch, salesApiEnabled } from "./server";
function sameOrigin(req: NextRequest) {
  try {
    const origin = new URL(req.headers.get("origin") || "");
    const forwarded = req.headers.get("x-forwarded-proto");
    const protocol = forwarded === "https" || forwarded === "http" ? `${forwarded}:` : req.nextUrl.protocol;
    return origin.host.toLowerCase() === (req.headers.get("host") || req.nextUrl.host).toLowerCase() &&
      origin.protocol === protocol;
  } catch { return false; }
}
export async function salesProxy(req: NextRequest, path: string[]) {
  if (!salesApiEnabled()) return NextResponse.json({ erro: "API desativada" }, { status: 503 });
  const allowed = (req.method === "POST" && path.length === 0) ||
    (req.method === "GET" && path.length === 1 && path[0] === "hoje");
  if (!allowed) return NextResponse.json({ erro: "Operacao invalida" }, { status: 400 });
  if (req.method === "POST" && !sameOrigin(req)) return NextResponse.json({ erro: "Origem invalida" }, { status: 403 });
  if (!(await cookies()).get(API_COOKIE)?.value) return NextResponse.json({ erro: "Sessao expirada." }, { status: 401 });
  try {
    const body = req.method === "POST" ? await req.text() : undefined;
    if (body && body.length > 100000) return NextResponse.json({ erro: "Dados excessivos" }, { status: 413 });
    const response = await apiFetch(`admin/vendas${path.length ? `/${path.join("/")}` : ""}`,
      { method: req.method, body });
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ erro: response.status === 409 ?
      "A venda ou o turno mudou. Atualize a tela." : response.status === 400 ?
      "Confira itens e pagamentos." : response.status === 401 ? "Sessao expirada." :
      "Nao foi possivel registrar a venda." }, { status: response.status });
    return NextResponse.json(result, { status: response.status, headers: { "cache-control": "no-store" } });
  } catch { return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 }); }
}
