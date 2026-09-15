import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_COOKIE, apiFetch, pdvStatusApiEnabled } from "@/lib/api/server";

export async function GET() {
  if (!pdvStatusApiEnabled()) return NextResponse.json({ erro: "API desativada" }, { status: 503 });
  if (!(await cookies()).get(API_COOKIE)?.value) {
    return NextResponse.json({ erro: "Sessao expirada. Entre novamente." }, { status: 401 });
  }
  try {
    const response = await apiFetch("pdvs");
    const body = await response.json();
    if (!response.ok) return NextResponse.json({ erro: response.status === 403 ? "Sem permissao." :
      "Nao foi possivel consultar os caixas." }, { status: response.status });
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 });
  }
}
