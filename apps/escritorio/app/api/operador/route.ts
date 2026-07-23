import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// Resolve o **operador logado** (feature 009, D10): lê o cookie `app_user` (login,
// httpOnly) e devolve o `usuario.sync_uid` real. É essa identidade — não o
// `auth.uid()` da sessão de serviço COMPARTILHADA (#15) — que carimba turno/venda;
// senão todos os operadores colidiriam numa só identidade.
export async function GET() {
  const login = (await cookies()).get("app_user")?.value;
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
