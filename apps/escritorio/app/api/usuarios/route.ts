import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// Cria um usuário (feature 010, US1). A identidade do admin vem do cookie httpOnly
// `app_user` (server-side) — nunca do cliente — e é validada pela RPC `criar_usuario`
// (SECURITY DEFINER; o hash é gerado no Postgres). Só admin passa pela guarda.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const usuario = String(body.usuario ?? "").trim();
  const nome = String(body.nome ?? "").trim();
  const perfil = body.perfil === "admin" ? "admin" : "operador";
  const senha = String(body.senha ?? "");

  if (!usuario) return NextResponse.json({ erro: "Informe o usuário." }, { status: 400 });
  if (senha.length < 4) return NextResponse.json({ erro: "Senha deve ter ao menos 4 caracteres." }, { status: 400 });

  const admin = (await cookies()).get("app_user")?.value;
  if (!admin) return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });

  const supabase = await createClient();
  const { error } = await supabase.rpc("criar_usuario", {
    p_admin: admin,
    p_usuario: usuario,
    p_nome: nome,
    p_senha: senha,
    p_perfil: perfil,
  });
  if (error) {
    const msg = /ja existe/i.test(error.message)
      ? "Já existe um usuário com esse identificador."
      : /sem permissao/i.test(error.message)
        ? "Sem permissão para cadastrar usuários."
        : "Não foi possível cadastrar.";
    return NextResponse.json({ erro: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
