import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { requiredEnv } from "@/utils/env";
import { apiFeaturesEnabled, apiOnlyMode, apiOrigin } from "@/lib/api/config";

type CookieItem = { name: string; value: string; options: CookieOptions };

const isPublic = (path: string) => path.startsWith("/login") ||
  path.startsWith("/api") || path.startsWith("/_next") || path === "/favicon.ico";

function loginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

async function updateApiSession(request: NextRequest) {
  if (isPublic(request.nextUrl.pathname)) return NextResponse.next({ request });
  const token = request.cookies.get("nuvem_usuario")?.value;
  if (!token) return loginRedirect(request);
  try {
    const response = await fetch(`${apiOrigin()}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${token}` }, cache: "no-store",
      signal: AbortSignal.timeout(5000), redirect: "error",
    });
    if (!response.ok) return loginRedirect(request);
    const user = await response.json();
    if (user.tipo !== "usuario" || user.perfil !== "admin") return loginRedirect(request);
    return NextResponse.next({ request });
  } catch {
    return loginRedirect(request);
  }
}

// Atualiza a sessão e protege rotas: sem sessão → redireciona para /login.
export async function updateSession(request: NextRequest) {
  if (apiOnlyMode()) return updateApiSession(request);
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
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
  const apiSessionMissing = apiFeaturesEnabled() && !request.cookies.get("nuvem_usuario")?.value;
  if ((!user || apiSessionMissing) && !isPublic(path)) return loginRedirect(request);

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
