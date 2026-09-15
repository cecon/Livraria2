import { NextRequest, NextResponse } from "next/server";
import { referencesProxy, type ReferenceResource } from "@/lib/api/referencias-proxy";

async function handle(request: NextRequest,
  context: { params: Promise<{ recurso: string; uid: string }> }) {
  const { recurso, uid } = await context.params;
  if (recurso !== "formas" && recurso !== "fornecedores") {
    return NextResponse.json({ erro: "Recurso invalido" }, { status: 404 });
  }
  return referencesProxy(request, recurso as ReferenceResource, uid);
}
export const PUT = handle;
export const DELETE = handle;
