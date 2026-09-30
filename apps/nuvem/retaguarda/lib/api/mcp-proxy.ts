import { NextRequest, NextResponse } from "next/server";
import { apiOrigin } from "./config";
import { publicOrigin } from "./public-origin";

export async function mcpProxy(req: NextRequest) {
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();
  if (body && body.length > 150000) return NextResponse.json({ erro: "Dados excessivos." }, { status: 413 });
  const headers: Record<string, string> = { "x-ia-public-origin": publicOrigin(req) };
  for (const name of ["authorization", "content-type", "accept", "mcp-protocol-version", "mcp-session-id", "last-event-id"]) {
    const value = req.headers.get(name); if (value) headers[name] = value;
  }
  const response = await fetch(`${apiOrigin()}/api/v1/ia/mcp`, { method: req.method, body, headers,
    redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(60000) });
  const bytes = await response.arrayBuffer();
  const out: Record<string, string> = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
  for (const name of ["content-type", "www-authenticate", "mcp-session-id"]) {
    const value = response.headers.get(name); if (value) out[name] = value;
  }
  return new NextResponse(bytes.byteLength ? bytes : null, { status: response.status, headers: out });
}
