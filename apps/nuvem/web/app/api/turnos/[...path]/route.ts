import { NextRequest } from "next/server";
import { shiftsProxy } from "@/lib/api/turnos-proxy";
type Context = { params: Promise<{ path: string[] }> };
const proxy = async (request: NextRequest, context: Context) => shiftsProxy(request, (await context.params).path);
export const GET = proxy;
export const POST = proxy;
