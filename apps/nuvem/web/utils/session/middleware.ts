import { type NextRequest, NextResponse } from "next/server";

const isPublic = (path: string) => path.startsWith("/login") ||
  path.startsWith("/api") || path.startsWith("/_next") || path === "/favicon.ico";

function loginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  if (isPublic(request.nextUrl.pathname)) return NextResponse.next({ request });
  const token = request.cookies.get("nuvem_usuario")?.value;
  if (!token) return loginRedirect(request);
  return NextResponse.next({ request });
}
