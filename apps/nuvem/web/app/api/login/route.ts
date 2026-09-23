import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_COOKIE, apiLogin } from "@/lib/api/server";
import { requestUsesHttps } from "@/lib/api/request-security";

export async function POST(request: NextRequest) {
  const { usuario, senha } = await request.json().catch(() => ({}));
  const login = String(usuario ?? "").trim().toLowerCase();
  if (!login || !senha) {
    return NextResponse.json({ erro: "Informe usuario e senha." }, { status: 400 });
  }
  try {
    const session = await apiLogin(login, String(senha));
    const store = await cookies();
    const secure = requestUsesHttps(request);
    store.set("app_user", session.user.usuario, {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: session.expiresIn, secure,
    });
    store.set(API_COOKIE, session.accessToken, {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: session.expiresIn, secure,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({
      erro: "Nao foi possivel entrar. Confira suas credenciais e a conexao.",
    }, { status: 403 });
  }
}
