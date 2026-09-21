import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/session/middleware";

const ROTAS_PUBLICAS_API = [
  "/mcp",
  "/.well-known",
  "/api/v1",
  "/api/api",
  "/api/auth",
  "/api/rest",
  "/api/sync",
  "/api/pdv",
  "/api/pdvs",
  "/api/produtos-pdv",
  "/api/ia",
  "/api/capas",
  "/ia/conectar",
  "/produtos-pdv",
  "/pdvs",
  "/sync",
  "/auth",
  "/rest",
];

function caminhoComecaComSegmento(caminho: string, rota: string) {
  return caminho === rota || caminho.startsWith(`${rota}/`);
}

export async function middleware(request: NextRequest) {
  const caminho = request.nextUrl.pathname;
  if (ROTAS_PUBLICAS_API.some((rota) => caminhoComecaComSegmento(caminho, rota))) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  // Roda em tudo menos assets estáticos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

