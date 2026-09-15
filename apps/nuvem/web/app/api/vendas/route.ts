import { NextRequest } from "next/server";
import { salesProxy } from "@/lib/api/vendas-proxy";
export const POST = (request: NextRequest) => salesProxy(request, []);
