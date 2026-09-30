import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_COOKIE, apiFetch } from "./server";
import { sameOrigin } from "./catalogo-proxy";

export async function imageUploadProxy(req: NextRequest, deviceToken?: string) {
  if (!deviceToken && !sameOrigin(req)) return NextResponse.json({ erro: "Origem inválida." }, { status: 403 });
  const token = deviceToken ?? (await cookies()).get(API_COOKIE)?.value;
  if (!token) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ erro: "Formato inválido." }, { status: 415 });
  }
  const reader = req.body?.getReader();
  if (!reader) return NextResponse.json({ erro: "Envie a imagem." }, { status: 400 });
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 7_000_000) { await reader.cancel(); return NextResponse.json({ erro: "Imagem muito grande. Limite: 5 MB." }, { status: 413 }); }
      chunks.push(value);
    }
    const response = await apiFetch("capas", { method: "POST", body: Buffer.concat(chunks).toString("utf8") }, token, 30000);
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ erro: result.message ?? "Falha ao enviar imagem." }, { status: response.status });
    return NextResponse.json(result, { status: 201 });
  } catch { return NextResponse.json({ erro: "Não foi possível enviar a imagem. Tente novamente." }, { status: 502 }); }
}
