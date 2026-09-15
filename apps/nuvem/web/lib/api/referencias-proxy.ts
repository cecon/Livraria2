import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_COOKIE, apiFetch, referencesApiEnabled } from "./server";

export type ReferenceResource = "formas" | "fornecedores";

function sameOrigin(req: NextRequest) {
  try {
    const origin = new URL(req.headers.get("origin") || "");
    const host = req.headers.get("host") || req.nextUrl.host;
    const forwarded = req.headers.get("x-forwarded-proto");
    const protocol = forwarded === "https" || forwarded === "http" ? `${forwarded}:` : req.nextUrl.protocol;
    return origin.host.toLowerCase() === host.toLowerCase() && origin.protocol === protocol;
  } catch { return false; }
}

function validUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function referencesProxy(req: NextRequest, resource: ReferenceResource, id?: string,
  action?: "ativa" | "reordenar") {
  if (!referencesApiEnabled()) return NextResponse.json({ erro: "API desativada" }, { status: 503 });
  if (id && !validUuid(id)) return NextResponse.json({ erro: "UUID invalido" }, { status: 400 });
  if ((action === "ativa" && (!id || resource !== "formas")) ||
      (action === "reordenar" && (id || resource !== "formas"))) {
    return NextResponse.json({ erro: "Operacao invalida" }, { status: 400 });
  }
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
    const suffix = action === "reordenar" ? "/reordenar" : `${id ? `/${id}` : ""}${action ? `/${action}` : ""}`;
    const response = await apiFetch(`admin/${resource}${suffix}${query}`, { method: req.method, body });
    const result = await response.json();
    if (!response.ok) {
      const erro = response.status === 401 ? "Sessao expirada. Entre novamente."
        : response.status === 409 ? "A lista mudou ou o cadastro ja existe. Recarregue e confira os dados."
        : response.status === 400 ? "Confira os dados informados."
        : response.status === 403 ? "Esta operacao nao e permitida." : "Referencias indisponiveis.";
      return NextResponse.json({ erro }, { status: response.status });
    }
    return NextResponse.json(result, { status: response.status });
  } catch {
    return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 });
  }
}
