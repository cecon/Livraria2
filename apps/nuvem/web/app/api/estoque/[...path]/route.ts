import { NextRequest } from "next/server";
import { stockProxy } from "@/lib/api/estoque-proxy";

type Context = { params: Promise<{ path: string[] }> };
const proxy = async (request: NextRequest, context: Context) =>
  stockProxy(request, (await context.params).path);

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
