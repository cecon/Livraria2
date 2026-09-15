import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { requiredEnv } from "@/utils/env";

type CookieItem = { name: string; value: string; options: CookieOptions };

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

// Atualiza a sessão e protege rotas: sem sessão → redireciona para /login.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieItem[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // `/api` é público no gate: as rotas de auth (login/logout) tratam a própria sessão
  // e o login precisa rodar ANTES de existir sessão.
  const publica =
    path.startsWith("/login") ||
    path.startsWith("/api") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico";
  const apiEnabled = process.env.API_CATALOGO_ENABLED === "true" || process.env.API_REFERENCIAS_ENABLED === "true" ||
    process.env.API_USUARIOS_ENABLED === "true" || process.env.API_PDV_STATUS_ENABLED === "true" ||
    process.env.API_ESTOQUE_ENABLED === "true" || process.env.API_LANCAMENTOS_ENABLED === "true" ||
    process.env.API_TURNOS_ENABLED === "true" || process.env.API_VENDAS_ENABLED === "true";
  const apiSessionMissing = apiEnabled && !request.cookies.get("nuvem_usuario")?.value;
  if ((!user || apiSessionMissing) && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Senha temporária: enquanto a flag estiver setada, prende o usuário na troca
  // de senha (exceto na própria rota). Ver app/trocar-senha.
  const precisaTrocar = user?.user_metadata?.must_change_password === true;
  if (user && precisaTrocar && !path.startsWith("/trocar-senha")) {
    const url = request.nextUrl.clone();
    url.pathname = "/trocar-senha";
    return NextResponse.redirect(url);
  }
  return supabaseResponse;
}
