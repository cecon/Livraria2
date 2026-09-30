import { NextRequest } from "next/server";
import { devicesProxy } from "@/lib/api/pdvs-proxy";

type Context = { params: Promise<{ path: string[] }> };

export async function PUT(request: NextRequest, context: Context) {
  return devicesProxy(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: Context) {
  return devicesProxy(request, (await context.params).path);
}
