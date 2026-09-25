import { NextRequest } from "next/server";
import { reportsProxy } from "@/lib/api/relatorios-proxy";
export const GET = (request: NextRequest) => reportsProxy(request, "destinacoes");
