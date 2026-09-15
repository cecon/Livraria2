import { NextResponse } from "next/server";
import { stockApiEnabled } from "@/lib/api/server";

export function GET() {
  return NextResponse.json({ enabled: stockApiEnabled() }, { headers: { "cache-control": "no-store" } });
}
