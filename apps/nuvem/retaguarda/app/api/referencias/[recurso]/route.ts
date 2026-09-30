import { NextRequest, NextResponse } from "next/server";
import { referencesProxy, type ReferenceResource } from "@/lib/api/referencias-proxy";

async function handle(request: NextRequest, context: { params: Promise<{ recurso: string }> }) {
  const { recurso } = await context.params;
  if (recurso !== "formas" && recurso !== "fornecedores" && recurso !== "destinacoes") {
    return NextResponse.json({ erro: "Recurso invalido" }, { status: 404 });
  }
  return referencesProxy(request, recurso as ReferenceResource);
}
export const GET = handle;
export const POST = handle;
