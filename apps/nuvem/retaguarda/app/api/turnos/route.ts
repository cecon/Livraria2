import { NextRequest } from "next/server";
import { shiftsProxy } from "@/lib/api/turnos-proxy";
export const GET = (request: NextRequest) => shiftsProxy(request, []);
