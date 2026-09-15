import { NextRequest } from "next/server";
import { referencesProxy } from "@/lib/api/referencias-proxy";

export async function PUT(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  return referencesProxy(request, "destinacoes", (await context.params).uid, "ativa");
}
