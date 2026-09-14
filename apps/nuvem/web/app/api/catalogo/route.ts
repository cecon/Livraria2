import { catalogProxy } from "@/lib/api/catalogo-proxy";
import { NextRequest } from "next/server";

export const GET = (request: NextRequest) => catalogProxy(request);
export const POST = GET;
