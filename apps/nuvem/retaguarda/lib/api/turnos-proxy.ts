import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_COOKIE, apiFetch } from "./server";

export async function shiftsProxy(req: NextRequest, path: string[]) {
  if (req.method !== "GET" || path.length !== 0) {
    return NextResponse.json({ erro: "Operacao invalida" }, { status: 405 });
  }
  if (!(await cookies()).get(API_COOKIE)?.value) {
    return NextResponse.json({ erro: "Sessao expirada." }, { status: 401 });
  }
  try {
    const response = await apiFetch("admin/turnos", { method: "GET" });
    const result = await response.json();
    if (!response.ok) {
      return NextResponse.json({ erro: response.status === 401 ? "Sessao expirada." : "Turnos indisponiveis." },
        { status: response.status });
    }
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 });
  }
}
