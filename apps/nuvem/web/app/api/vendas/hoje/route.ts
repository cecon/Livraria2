import { NextRequest } from "next/server";
import { salesProxy } from "@/lib/api/vendas-proxy";
export const GET = (request: NextRequest) => salesProxy(request, ["hoje"]);
