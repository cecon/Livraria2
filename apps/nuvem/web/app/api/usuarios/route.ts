import { NextRequest } from "next/server";
import { usersProxy } from "@/lib/api/usuarios-proxy";

export const GET = (request: NextRequest) => usersProxy(request);
export const POST = (request: NextRequest) => usersProxy(request);

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const usuario = String(body.usuario ?? "").trim().toLowerCase();
  return usersProxy(request, usuario, undefined, {
    nome: String(body.nome ?? "").trim(), perfil: body.perfil === "admin" ? "admin" : "operador",
  });
}
