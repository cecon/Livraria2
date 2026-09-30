import { NextRequest } from "next/server";
import { referencesProxy } from "@/lib/api/referencias-proxy";
export const GET = (request: NextRequest) => referencesProxy(request, "destinacoes");
export const POST = (request: NextRequest) => referencesProxy(request, "destinacoes");
