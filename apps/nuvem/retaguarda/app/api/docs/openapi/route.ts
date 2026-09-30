import { NextResponse } from "next/server";
import { createOpenApiDocument } from "@/lib/openapi";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(createOpenApiDocument());
}
