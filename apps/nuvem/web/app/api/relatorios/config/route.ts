import { NextResponse } from "next/server";
import { reportsApiEnabled } from "@/lib/api/server";
export function GET() { return NextResponse.json({ enabled: reportsApiEnabled() },
  { headers: { "cache-control": "no-store" } }); }
