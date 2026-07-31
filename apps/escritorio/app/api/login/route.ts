import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

async function autenticarPerfil(usuario: string, senha: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.ESCRITORIO_EMAIL;
  const password = process.env.ESCRITORIO_SENHA;
  if (!url || !key || !email || !password) {
    return { perfil: null, error: new Error("Supabase nao configurado") };
  }

  const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: key,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!auth.ok) {
    return { perfil: null, error: new Error(`Auth servico HTTP ${auth.status}`) };
  }
  const session = await auth.json().catch(() => ({}));
  const token = typeof session.access_token === "string" ? session.access_token : null;
  if (!token) {
    return { perfil: null, error: new Error("Auth servico sem token") };
  }

  const response = await fetch(`${url}/rest/v1/rpc/autenticar_perfil`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_usuario: usuario, p_senha: senha }),
    cache: "no-store",
  });

  if (!response.ok) {
    return { perfil: null, error: new Error(`RPC autenticar_perfil HTTP ${response.status}`) };
  }

  return { perfil: await response.json(), error: null };
}

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
  const { perfil, error } = await autenticarPerfil(u, String(senha));
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
