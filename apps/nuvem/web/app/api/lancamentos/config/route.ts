import { NextResponse } from "next/server";
import { entriesApiEnabled } from "@/lib/api/server";

export function GET() {
  return NextResponse.json({ enabled: entriesApiEnabled() }, { headers: { "cache-control": "no-store" } });
}
