import { NextRequest, NextResponse } from "next/server";
import { apiOrigin } from "@/lib/api/config";
import { publicOrigin } from "@/lib/api/public-origin";

export async function GET(req: NextRequest) {
  const response = await fetch(`${apiOrigin()}/api/v1/ia/oauth/protected-resource`, {
    headers: { "x-ia-public-origin": publicOrigin(req) }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  return new NextResponse(await response.text(), { status: response.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
