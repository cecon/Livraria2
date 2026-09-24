import { NextRequest } from "next/server";
import { stockProxy } from "@/lib/api/estoque-proxy";

export const GET = (request: NextRequest) => stockProxy(request, ["saldos"]);
