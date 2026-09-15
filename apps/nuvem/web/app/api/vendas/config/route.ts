import { NextResponse } from "next/server";
import { salesApiEnabled } from "@/lib/api/server";
export function GET() { return NextResponse.json({ enabled: salesApiEnabled() },
  { headers: { "cache-control": "no-store" } }); }
