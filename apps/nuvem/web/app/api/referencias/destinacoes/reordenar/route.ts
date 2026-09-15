import { NextRequest } from "next/server";
import { referencesProxy } from "@/lib/api/referencias-proxy";

export const PUT = (request: NextRequest) => referencesProxy(request, "destinacoes", undefined, "reordenar");
