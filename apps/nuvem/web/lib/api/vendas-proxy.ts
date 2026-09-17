import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_COOKIE, apiFetch } from "./server";
export async function salesProxy(req: NextRequest, path: string[]) {
  const allowed = req.method === "GET" && path.length === 1 && path[0] === "hoje";
  if (!allowed) return NextResponse.json({ erro: "Operacao invalida" }, { status: 405 });
  if (!(await cookies()).get(API_COOKIE)?.value) return NextResponse.json({ erro: "Sessao expirada." }, { status: 401 });
  try {
    const response = await apiFetch(`admin/vendas${path.length ? `/${path.join("/")}` : ""}`,
      { method: "GET" });
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ erro: response.status === 409 ?
      "A venda ou o turno mudou. Atualize a tela." : response.status === 400 ?
      "Confira os dados da consulta." : response.status === 401 ? "Sessao expirada." :
      "Nao foi possivel consultar as vendas." }, { status: response.status });
    return NextResponse.json(result, { status: response.status, headers: { "cache-control": "no-store" } });
  } catch { return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 }); }
}
