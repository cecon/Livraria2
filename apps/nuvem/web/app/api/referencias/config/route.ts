import { NextResponse } from "next/server";
import { referencesApiEnabled } from "@/lib/api/server";

export function GET() {
  return NextResponse.json({ enabled: referencesApiEnabled() }, { headers: { "cache-control": "no-store" } });
}
