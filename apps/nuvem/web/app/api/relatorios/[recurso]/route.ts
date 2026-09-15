import { NextRequest } from "next/server";
import { reportsProxy } from "@/lib/api/relatorios-proxy";
type Context = { params: Promise<{ recurso: string }> };
export async function GET(request: NextRequest, context: Context) {
  return reportsProxy(request, (await context.params).recurso);
}
