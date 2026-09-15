import { NextRequest } from "next/server";
import { shiftsProxy } from "@/lib/api/turnos-proxy";
const proxy = (request: NextRequest) => shiftsProxy(request, []);
export const GET = proxy;
export const POST = proxy;
