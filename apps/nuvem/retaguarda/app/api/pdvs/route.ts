import { NextRequest } from "next/server";
import { devicesProxy } from "@/lib/api/pdvs-proxy";

export const GET = (request: NextRequest) => devicesProxy(request);
export const POST = (request: NextRequest) => devicesProxy(request);
