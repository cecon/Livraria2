import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_COOKIE, apiFetch } from "./server";

function sameOrigin(req: NextRequest) {
  try {
    const origin = new URL(req.headers.get("origin") || "");
    const host = req.headers.get("host") || req.nextUrl.host;
    const forwardedProtocol = req.headers.get("x-forwarded-proto");
    const protocol = forwardedProtocol === "https" || forwardedProtocol === "http"
      ? `${forwardedProtocol}:` : req.nextUrl.protocol;
    return origin.host.toLowerCase() === host.toLowerCase() && origin.protocol === protocol;
  } catch { return false; }
}

export async function catalogProxy(req: NextRequest, id?: string) {
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ erro: "UUID invalido" }, { status: 400 });
  if (req.method !== "GET" && !sameOrigin(req)) {
    return NextResponse.json({ erro: "Origem invalida" }, { status: 403 });
  }
  if (!(await cookies()).get(API_COOKIE)?.value) {
    return NextResponse.json({ erro: "Sessao expirada. Entre novamente." }, { status: 401 });
  }
  try {
    const after = req.nextUrl.searchParams.get("after");
    const query = req.method === "GET" && after ? `?after=${encodeURIComponent(after)}` : "";
    const body = ["POST", "PUT"].includes(req.method) ? await req.text() : undefined;
    if (body && body.length > 20000) return NextResponse.json({ erro: "Dados excessivos" }, { status: 413 });
    const response = await apiFetch(`admin/livros${id ? `/${id}` : ""}${query}`, { method: req.method, body });
    const result = await response.json();
    if (!response.ok) {
      const erro = response.status === 401 ? "Sessao expirada. Entre novamente."
        : response.status === 409 ? "Conflito no cadastro. Confira o codigo e os dados do produto."
        : response.status === 400 ? "Confira os dados informados."
        : response.status === 403 ? "Sem permissao." : "Operacao de catalogo indisponivel.";
      return NextResponse.json({ erro }, { status: response.status });
    }
    return NextResponse.json(result, { status: response.status });
  } catch {
    return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 });
  }
}
