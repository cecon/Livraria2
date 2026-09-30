import { NextRequest } from "next/server";

export function publicOrigin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "") || "https";
  return `${proto}://${host}`;
}
