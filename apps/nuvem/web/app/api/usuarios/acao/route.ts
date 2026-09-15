import { NextRequest, NextResponse } from "next/server";
import { usersProxy } from "@/lib/api/usuarios-proxy";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const usuario = String(body.usuario ?? "").trim().toLowerCase();
  const acao = String(body.acao ?? "");
  if (!usuario) return NextResponse.json({ erro: "Usuario invalido." }, { status: 400 });
  if (acao === "senha") return usersProxy(request, usuario, "senha", { senha: String(body.senha ?? "") });
  if (acao === "desativar" || acao === "reativar") {
    return usersProxy(request, usuario, "ativa", { ativa: acao === "reativar" });
  }
  return NextResponse.json({ erro: "Acao invalida." }, { status: 400 });
}
