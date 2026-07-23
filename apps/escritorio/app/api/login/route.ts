import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// Login da retaguarda por usuário/senha da tabela `usuario` (ADR-0019). Valida a
// credencial pelo RPC `autenticar_usuario` (SECURITY DEFINER — o hash nunca sai do
// Postgres) e, em caso positivo, abre a **sessão compartilhada** da retaguarda para
// o acesso a dados (RLS `authenticated`). Registra quem logou em `app_user`.
export async function POST(request: NextRequest) {
  const { usuario, senha } = await request.json().catch(() => ({}));
  const u = String(usuario ?? "").trim();
  if (!u || !senha) {
    return NextResponse.json({ erro: "Informe usuário e senha." }, { status: 400 });
  }

  const supabase = await createClient();

  // 1) credencial confere e devolve o **perfil** (feature 010, US2).
  const { data: perfil, error } = await supabase.rpc("autenticar_perfil", {
    p_usuario: u,
    p_senha: String(senha),
  });
  if (error) {
    return NextResponse.json({ erro: "Falha ao autenticar." }, { status: 500 });
  }
  // Gate do Escritório: só **admin** entra (regra do domínio `pode_acessar_escritorio` —
  // operador acessa só o PDV). NULL (credencial inválida / desativado) ou operador → negado,
  // com mensagem genérica (FR-013, não revela o motivo).
  if (perfil !== "admin") {
    return NextResponse.json(
      { erro: "Usuário ou senha inválidos, ou sem acesso ao escritório." },
      { status: 403 },
    );
  }

  // 2) abre a sessão de serviço compartilhada (dados via RLS authenticated).
  const email = process.env.ESCRITORIO_EMAIL;
  const password = process.env.ESCRITORIO_SENHA;
  if (!email || !password) {
    return NextResponse.json({ erro: "Sessão de serviço não configurada." }, { status: 500 });
  }
  const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
  if (e2) {
    return NextResponse.json({ erro: "Sessão indisponível." }, { status: 500 });
  }

  // 3) quem está logado (exibição/atribuição) — não é a credencial de dados.
  (await cookies()).set("app_user", u, { httpOnly: true, sameSite: "lax", path: "/" });
  return NextResponse.json({ ok: true });
}
