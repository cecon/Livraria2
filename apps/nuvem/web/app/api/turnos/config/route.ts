import { NextResponse } from "next/server";
import { shiftsApiEnabled } from "@/lib/api/server";
export function GET() { return NextResponse.json({ enabled: shiftsApiEnabled() },
  { headers: { "cache-control": "no-store" } }); }
