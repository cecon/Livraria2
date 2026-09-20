import { NextRequest } from "next/server";
import { llmProxy } from "@/lib/api/llm-proxy";

type Context = { params: Promise<{ path?: string[] }> };
const proxy = async (req: NextRequest, context: Context) => llmProxy(req, (await context.params).path);
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
