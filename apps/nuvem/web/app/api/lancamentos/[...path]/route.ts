import { NextRequest } from "next/server";
import { entriesProxy } from "@/lib/api/lancamentos-proxy";

type Context = { params: Promise<{ path: string[] }> };
const proxy = async (request: NextRequest, context: Context) =>
  entriesProxy(request, (await context.params).path);

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
