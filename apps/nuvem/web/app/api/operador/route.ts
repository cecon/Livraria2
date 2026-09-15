import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { apiFetch, apiOnlyMode } from "@/lib/api/server";

// Resolve o **operador logado** (feature 009, D10): lê o cookie `app_user` (login,
// httpOnly) e devolve o `usuario.sync_uid` real. É essa identidade — não o
// `auth.uid()` da sessão de serviço COMPARTILHADA (#15) — que carimba turno/venda;
// senão todos os operadores colidiriam numa só identidade.
export async function GET() {
  if (apiOnlyMode()) {
    try {
      const response = await apiFetch("auth/me");
      if (!response.ok) return NextResponse.json({ erro: "Sem operador logado." }, { status: 401 });
      const user = await response.json();
      if (user.tipo !== "usuario" || !user.uid || !user.usuario) {
        return NextResponse.json({ erro: "Operador nao encontrado." }, { status: 404 });
      }
      return NextResponse.json({ uid: user.uid, login: user.usuario,
        nome: user.nome ?? user.usuario });
    } catch {
      return NextResponse.json({ erro: "Sessao indisponivel." }, { status: 502 });
    }
  }
  const login = (await cookies()).get("app_user")?.value.trim().toLowerCase();
  if (!login) {
    return NextResponse.json({ erro: "Sem operador logado." }, { status: 401 });
  }
  const sb = await createClient();
  const { data, error } = await sb
    .from("usuario")
    .select("sync_uid,nome")
    .eq("usuario", login)
    .is("excluido_em", null)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ erro: "Operador não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ uid: data.sync_uid, login, nome: data.nome ?? login });
}
