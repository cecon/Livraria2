import { NextRequest } from "next/server";
import { catalogProxy } from "@/lib/api/catalogo-proxy";

async function handle(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  return catalogProxy(request, (await context.params).uid);
}
export const PUT = handle;
export const DELETE = handle;
