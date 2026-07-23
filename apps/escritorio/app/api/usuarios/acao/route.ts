import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// Ações sobre um usuário (feature 010, US3): redefinir senha, desativar, reativar.
// Admin da sessão via cookie httpOnly; RPCs SECURITY DEFINER com guarda do último admin.
export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const usuario = String(b.usuario ?? "").trim();
  const acao = String(b.acao ?? "");
  const senha = String(b.senha ?? "");
  const admin = (await cookies()).get("app_user")?.value;
  if (!admin) return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  if (!usuario) return NextResponse.json({ erro: "Usuário inválido." }, { status: 400 });

  const supabase = await createClient();
  let error;
  if (acao === "senha") {
    if (senha.length < 4) return NextResponse.json({ erro: "Senha deve ter ao menos 4 caracteres." }, { status: 400 });
    ({ error } = await supabase.rpc("definir_senha_usuario", { p_admin: admin, p_usuario: usuario, p_senha: senha }));
  } else if (acao === "desativar") {
    ({ error } = await supabase.rpc("desativar_usuario", { p_admin: admin, p_usuario: usuario }));
  } else if (acao === "reativar") {
    ({ error } = await supabase.rpc("reativar_usuario", { p_admin: admin, p_usuario: usuario }));
  } else {
    return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
  }
  if (error) {
    const m = error.message;
    const msg = /ao menos um admin/i.test(m)
      ? "Precisa existir ao menos um admin ativo."
      : /sem permissao/i.test(m)
        ? "Sem permissão."
        : "Não foi possível concluir.";
    return NextResponse.json({ erro: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
