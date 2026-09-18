import { NextRequest } from "next/server";
import { stockExportProxy } from "@/lib/api/relatorios-proxy";

type Context = { params: Promise<{ formato: string }> };

export async function GET(request: NextRequest, context: Context) {
  return stockExportProxy(request, (await context.params).formato);
}
