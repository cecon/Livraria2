import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "./server";
import { apiOrigin } from "./config";
import { publicOrigin } from "./public-origin";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error = (erro: string, status: number) => NextResponse.json({ erro }, { status, headers: { "cache-control": "no-store" } });
function sameOrigin(req: NextRequest) {
  try {
    const origin = new URL(req.headers.get("origin") || "");
    return origin.host === (req.headers.get("host") || req.nextUrl.host) && origin.protocol === `${req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "")}:`;
  } catch { return false; }
}
async function result(response: Response) {
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 20000000) return error("Resposta excessiva.", 502);
  const headers: Record<string, string> = { "content-type": response.headers.get("content-type") || "application/json",
    "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
  const disposition = response.headers.get("content-disposition");
  if (disposition) headers["content-disposition"] = disposition;
  return new NextResponse(bytes.byteLength ? bytes : null, { status: response.status, headers });
}
async function rawIa(req: NextRequest, target: string, body?: string, timeoutMs = 10000) {
  const headers: Record<string, string> = { "x-ia-public-origin": publicOrigin(req) };
  for (const name of ["authorization", "content-type", "accept", "mcp-protocol-version", "mcp-session-id", "last-event-id"]) {
    const value = req.headers.get(name); if (value) headers[name] = value;
  }
  const response = await fetch(`${apiOrigin()}/api/v1/${target}${req.nextUrl.search}`, { method: req.method, body, headers,
    redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  const bytes = await response.arrayBuffer();
  const out: Record<string, string> = { "cache-control": "no-store" };
  for (const name of ["content-type", "www-authenticate", "location", "mcp-session-id"]) {
    const value = response.headers.get(name); if (value) out[name] = value;
  }
  return new NextResponse(bytes.byteLength ? bytes : null, { status: response.status, headers: out });
}
export async function iaProxy(req: NextRequest, parts: string[]) {
  const path = parts.join("/");
  try {
    const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();
    if (body && body.length > (parts[0] === "v1" || path === "executar" ? 2100000 : 3000)) return error("Dados excessivos.", 413);
    if (parts[0] === "oauth") {
      if (path === "oauth/authorize" && req.method === "POST" && !sameOrigin(req)) return error("Abra a autorização na Livraria.", 403);
      if (["GET", "POST"].includes(req.method)) return await rawIa(req, `ia/${path}`, body, 15000);
      return error("Rota inválida.", 404);
    }
    if (path === "autorizar" || path === "gerenciar") {
      if (req.method !== "POST") return error("Rota inválida.", 404);
      if (!sameOrigin(req)) return error("Abra a página de autorização na Livraria.", 403);
      if (path === "autorizar") return await result(await apiFetch("ia/autorizar", { method: "POST", body }, ""));
      const data = JSON.parse(body || "{}");
      if (!["listar", "revogar", "historico"].includes(data.acao) || (data.acao !== "listar" && !UUID.test(data.uid))) return error("Ação inválida.", 400);
      const login = await apiFetch("auth/login", { method: "POST", body: JSON.stringify({ usuario: data.usuario, senha: data.senha }) }, "");
      if (!login.ok) return error("Confira usuário e senha.", 401);
      const session = await login.json();
      if (typeof session.accessToken !== "string") return error("Autenticação indisponível.", 502);
      const target = data.acao === "listar" ? "ia/acessos" : `ia/acessos/${data.uid}/${data.acao === "revogar" ? "revogar" : "historico"}`;
      return await result(await apiFetch(target, { method: data.acao === "revogar" ? "POST" : "GET" }, session.accessToken));
    }
    if (req.method === "POST" && path === "solicitacoes") return await result(await apiFetch("ia/solicitacoes", { method: "POST", body }, ""));
    if (req.method === "GET" && parts.length === 2 && parts[0] === "solicitacoes" && UUID.test(parts[1])) return await result(await apiFetch(`ia/${path}`, {}, ""));
    const bearer = /^Bearer (lia_[A-Za-z0-9_-]{43})$/.exec(req.headers.get("authorization") || "");
    if (!bearer) return error("Informe Authorization: Bearer <token temporário>.", 401);
    if (req.method === "GET" && path === "catalogo") return await result(await apiFetch("ia/catalogo", {}, bearer[1]));
    if (req.method === "POST" && path === "executar") return await result(await apiFetch("ia/executar", { method: "POST", body }, bearer[1], 60000));
    if (parts[0] === "v1" && parts.length > 1 && ["GET", "POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      const route = "/" + parts.slice(1).join("/");
      if (!/^\/[A-Za-z0-9/._-]+$/.test(route) || route.includes("..") || route.includes("//")) return error("Rota inválida.", 400);
      const payload = { metodo: req.method, rota: route, consulta: Object.fromEntries(req.nextUrl.searchParams), ...(body && { corpo: JSON.parse(body) }) };
      return await result(await apiFetch("ia/executar", { method: "POST", body: JSON.stringify(payload) }, bearer[1], 60000));
    }
    return error("Rota inválida.", 404);
  } catch { return error("Não foi possível concluir a solicitação. Confira os dados e a conexão.", 502); }
}
