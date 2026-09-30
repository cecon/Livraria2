import { NextRequest } from "next/server";
import { entriesProxy } from "@/lib/api/lancamentos-proxy";

const proxy = (request: NextRequest) => entriesProxy(request, []);
export const GET = proxy;
export const POST = proxy;
