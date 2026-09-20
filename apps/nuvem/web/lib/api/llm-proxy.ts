import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_COOKIE, apiFetch } from "./server";

export async function llmProxy(req: NextRequest, parts: string[] = []) {
  const valid = !parts.length || (/^[0-9a-f-]{36}$/i.test(parts[0]) &&
    (parts.length === 1 || (parts.length === 2 && parts[1] === "testar")));
  const allowed = (!parts.length && ["GET", "POST"].includes(req.method)) ||
    (parts.length === 1 && req.method === "PUT") || (parts.length === 2 && req.method === "POST");
  if (!valid || !allowed) return NextResponse.json({ erro: "Rota inválida" }, { status: 404 });
  if (req.method !== "GET") {
    try {
      const origin = new URL(req.headers.get("origin") || "");
      const protocol = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
      if (origin.host !== (req.headers.get("host") || req.nextUrl.host) || origin.protocol !== `${protocol}:`) throw new Error();
    } catch { return NextResponse.json({ erro: "Origem inválida" }, { status: 403 }); }
  }
  if (!(await cookies()).get(API_COOKIE)?.value) return NextResponse.json({ erro: "Entre novamente" }, { status: 401 });
  try {
    const body = req.method === "GET" ? undefined : await req.text();
    if (body && body.length > 12000) return NextResponse.json({ erro: "Dados excessivos" }, { status: 413 });
    const response = await apiFetch(`admin/llms${parts.length ? "/" + parts.join("/") : ""}`, { method: req.method, body });
    const data = await response.json();
    if (!response.ok) {
      const message = response.status === 400 || response.status === 409 ? data.message
        : response.status === 403 ? "Sem permissão para administrar LLMs."
        : response.status === 401 ? "Sessão expirada. Entre novamente." : "Cadastro indisponível. Confira a configuração do servidor.";
      return NextResponse.json({ erro: typeof message === "string" ? message : "Confira os dados informados." }, { status: response.status });
    }
    return NextResponse.json(data, { status: response.status, headers: { "cache-control": "no-store" } });
  } catch { return NextResponse.json({ erro: "Retaguarda indisponível. Tente novamente." }, { status: 502 }); }
}
