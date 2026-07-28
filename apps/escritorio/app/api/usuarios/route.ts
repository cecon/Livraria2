import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// Gestão de usuários (feature 010). O admin da sessão vem do cookie httpOnly `app_user`
// (server-side, nunca do cliente) e é validado pelas RPCs SECURITY DEFINER. O hash da
// senha é gerado no Postgres — nunca trafega para o cliente.

function mapErro(msg: string): string {
  if (/ja existe/i.test(msg)) return "Já existe um usuário com esse identificador.";
  if (/sem permissao/i.test(msg)) return "Sem permissão.";
  if (/ao menos um admin/i.test(msg)) return "Precisa existir ao menos um admin ativo.";
  if (/senha muito curta/i.test(msg)) return "Senha deve ter ao menos 4 caracteres.";
  if (/nao encontrado/i.test(msg)) return "Usuário não encontrado.";
  return "Não foi possível concluir.";
}

// Cria um usuário (US1).
export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const usuario = String(b.usuario ?? "").trim();
  const senha = String(b.senha ?? "");
  if (!usuario) return NextResponse.json({ erro: "Informe o usuário." }, { status: 400 });
  if (senha.length < 4) return NextResponse.json({ erro: "Senha deve ter ao menos 4 caracteres." }, { status: 400 });
  const admin = (await cookies()).get("app_user")?.value;
  if (!admin) return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("criar_usuario", {
    p_admin: admin,
    p_usuario: usuario,
    p_nome: String(b.nome ?? "").trim(),
    p_senha: senha,
    p_perfil: b.perfil === "admin" ? "admin" : "operador",
  });
  if (error) return NextResponse.json({ erro: mapErro(error.message) }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Edita nome/perfil (US3). A guarda do último admin é reforçada na RPC.
export async function PATCH(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const usuario = String(b.usuario ?? "").trim();
  if (!usuario) return NextResponse.json({ erro: "Usuário inválido." }, { status: 400 });
  const admin = (await cookies()).get("app_user")?.value;
  if (!admin) return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("editar_usuario", {
    p_admin: admin,
    p_usuario: usuario,
    p_nome: String(b.nome ?? "").trim(),
    p_perfil: b.perfil === "admin" ? "admin" : "operador",
  });
  if (error) return NextResponse.json({ erro: mapErro(error.message) }, { status: 400 });
  return NextResponse.json({ ok: true });
}
