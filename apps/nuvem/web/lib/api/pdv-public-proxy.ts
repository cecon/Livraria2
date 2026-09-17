import { NextRequest, NextResponse } from "next/server";
import { apiFetch, apiLogin } from "./server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function configure(request: NextRequest) {
  const text = await request.text();
  if (text.length > 1000) return NextResponse.json({ erro: "Dados excessivos." }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text || "{}");
  } catch {
    return NextResponse.json({ erro: "Dados invalidos." }, { status: 400 });
  }
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const usuario = typeof body.usuario === "string" ? body.usuario.trim().toLowerCase() : "";
  const senha = typeof body.senha === "string" ? body.senha : "";
  if (!nome || nome.length > 100 || !usuario || usuario.length > 100 || !senha || senha.length > 200) {
    return NextResponse.json({ erro: "Dados invalidos." }, { status: 400 });
  }
  try {
    const session = await apiLogin(usuario, senha);
    const listed = await apiFetch("pdvs", {}, session.accessToken);
    if (!listed.ok) return upstreamError(listed);
    const devices = await listed.json() as Array<{ uid?: unknown; nome?: unknown; ativo?: unknown }>;
    const existing = devices.find(item => item.ativo === true && typeof item.nome === "string" &&
      item.nome.localeCompare(nome, undefined, { sensitivity: "accent" }) === 0);
    const uid = existing && typeof existing.uid === "string" && UUID.test(existing.uid)
      ? existing.uid : null;
    const response = uid
      ? await apiFetch(`pdvs/${uid}/token`, { method: "POST" }, session.accessToken)
      : await apiFetch("pdvs", { method: "POST",
        body: JSON.stringify({ nome, usuarioUid: session.user.uid }) }, session.accessToken);
    if (!response.ok) return upstreamError(response);
    const result = await response.json() as { uid?: unknown; refreshToken?: unknown };
    const deviceUid = uid ?? (typeof result.uid === "string" ? result.uid : "");
    if (!UUID.test(deviceUid) || typeof result.refreshToken !== "string") {
      return NextResponse.json({ erro: "Resposta invalida." }, { status: 502 });
    }
    return NextResponse.json({ uid: deviceUid, refreshToken: result.refreshToken });
  } catch {
    return NextResponse.json({ erro: "Credenciais invalidas ou API indisponivel." }, { status: 401 });
  }
}

function bearer(request: NextRequest) {
  const value = request.headers.get("authorization") ?? "";
  return /^Bearer [A-Za-z0-9._-]{20,4096}$/.test(value) ? value.slice(7) : null;
}

async function forward(request: NextRequest, path: string, requiresToken: boolean) {
  const token = requiresToken ? bearer(request) ?? undefined : undefined;
  if (requiresToken && !token) return NextResponse.json({ erro: "Credencial ausente." }, { status: 401 });
  const text = request.method === "GET" ? undefined : await request.text();
  if (text && text.length > 1_000_000) {
    return NextResponse.json({ erro: "Dados excessivos." }, { status: 413 });
  }
  try {
    const response = await apiFetch(path, { method: request.method, body: text }, token);
    const responseText = await response.text();
    return new NextResponse(responseText || null, { status: response.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ erro: "API indisponivel." }, { status: 502 });
  }
}

async function upstreamError(response: Response) {
  return NextResponse.json({ erro: "Operacao recusada pela API." }, { status: response.status });
}

export async function publicPdvProxy(request: NextRequest, path: string[]) {
  if (request.method === "POST" && path.join("/") === "configurar") return configure(request);
  if (request.method === "POST" && path.join("/") === "renovar") {
    return forward(request, "auth/pdv/renovar", false);
  }
  if (request.method === "GET" && path.join("/") === "catalogo") {
    const cursor = request.nextUrl.searchParams.get("cursor") ?? "0";
    const limite = request.nextUrl.searchParams.get("limite") ?? "100";
    if (!/^\d+$/.test(cursor) || !/^(?:[1-9]|[1-9]\d|100)$/.test(limite)) {
      return NextResponse.json({ erro: "Consulta invalida." }, { status: 400 });
    }
    return forward(request, `sync/catalogo?cursor=${cursor}&limite=${limite}`, true);
  }
  if (request.method === "POST" && path.join("/") === "catalogo/confirmacao") {
    return forward(request, "sync/catalogo/confirmacao", true);
  }
  if (request.method === "POST" && path.join("/") === "vendas") {
    return forward(request, "sync/vendas", true);
  }
  if (request.method === "POST" && path.join("/") === "turnos") {
    return forward(request, "sync/turnos", true);
  }
  if (request.method === "POST" && path.join("/") === "caixa-movimentos") {
    return forward(request, "sync/caixa-movimentos", true);
  }
  if (request.method === "POST" && path.length === 3 && path[0] === "turnos" &&
      UUID.test(path[1]) && path[2] === "encerramento") {
    return forward(request, `sync/turnos/${path[1]}/encerramento`, true);
  }
  if (request.method === "POST" && path.length === 3 && path[0] === "vendas" &&
      UUID.test(path[1]) && path[2] === "cancelamento") {
    return forward(request, `sync/vendas/${path[1]}/cancelamento`, true);
  }
  return NextResponse.json({ erro: "Rota inexistente." }, { status: 404 });
}
