import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_COOKIE, apiFetch } from "./server";

const PARAMETERS: Record<string, string[]> = {
  estoque: [], destinacoes: ["inicio", "fim"], vendas: ["data", "periodo"], dashboard: ["periodo"],
};
export async function reportsProxy(req: NextRequest, resource: string) {
  const expected = PARAMETERS[resource];
  if (req.method !== "GET" || !expected) return NextResponse.json({ erro: "Operacao invalida" }, { status: 400 });
  const keys = [...req.nextUrl.searchParams.keys()];
  if (keys.some(key => !expected.includes(key)) || expected.some(key => !req.nextUrl.searchParams.get(key))) {
    return NextResponse.json({ erro: "Filtros invalidos" }, { status: 400 });
  }
  if (!(await cookies()).get(API_COOKIE)?.value) return NextResponse.json({ erro: "Sessao expirada." }, { status: 401 });
  try {
    const query = new URLSearchParams();
    expected.forEach(key => query.set(key, req.nextUrl.searchParams.get(key)!));
    const response = await apiFetch(`admin/relatorios/${resource}${expected.length ? `?${query}` : ""}`);
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ erro: response.status === 400 ?
      "Confira o periodo informado." : response.status === 401 ? "Sessao expirada." :
      "Relatorio indisponivel." }, { status: response.status });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch { return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 }); }
}

export async function stockExportProxy(req: NextRequest, format: string) {
  if (req.method !== "GET" || !["pdf", "xlsx"].includes(format) || req.nextUrl.search) {
    return NextResponse.json({ erro: "Exportacao invalida" }, { status: 400 });
  }
  if (!(await cookies()).get(API_COOKIE)?.value) {
    return NextResponse.json({ erro: "Sessao expirada." }, { status: 401 });
  }
  try {
    const response = await apiFetch(`admin/relatorios/estoque/${format}`);
    if (!response.ok) return NextResponse.json({ erro: response.status === 401 ?
      "Sessao expirada." : "Nao foi possivel gerar o arquivo." }, { status: response.status });
    return new NextResponse(response.body, { status: 200, headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": response.headers.get("content-disposition") ?? `attachment; filename="estoque.${format}"`,
      "cache-control": "private, no-store",
    } });
  } catch {
    return NextResponse.json({ erro: "API indisponivel. Tente novamente." }, { status: 502 });
  }
}
