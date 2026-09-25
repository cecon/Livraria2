import { NextRequest } from "next/server";
import { mcpProxy } from "@/lib/api/mcp-proxy";

export const POST = (req: NextRequest) => mcpProxy(req);
export const GET = (req: NextRequest) => mcpProxy(req);
export const DELETE = (req: NextRequest) => mcpProxy(req);
