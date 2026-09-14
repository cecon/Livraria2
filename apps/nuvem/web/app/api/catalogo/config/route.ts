import { NextResponse } from "next/server";
import { catalogApiEnabled } from "@/lib/api/server";

export function GET() {
  return NextResponse.json({ enabled: catalogApiEnabled() }, { headers: { "cache-control": "no-store" } });
}
