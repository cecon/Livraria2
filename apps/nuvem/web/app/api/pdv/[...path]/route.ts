import { NextRequest } from "next/server";
import { publicPdvProxy } from "@/lib/api/pdv-public-proxy";

type Context = { params: Promise<{ path: string[] }> };

const proxy = async (request: NextRequest, context: Context) =>
  publicPdvProxy(request, (await context.params).path);

export const GET = proxy;
export const POST = proxy;
