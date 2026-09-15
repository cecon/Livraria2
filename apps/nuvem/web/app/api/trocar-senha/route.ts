import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiFetch, apiOnlyMode } from "@/lib/api/server";

function sameOrigin(request: NextRequest) {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.slice(0, -1);
    return origin.host.toLowerCase() === (request.headers.get("host") ?? request.nextUrl.host).toLowerCase() &&
      origin.protocol === `${protocol}:`;
  } catch { return false; }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ erro: "Origem invalida." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const senha = typeof body.senha === "string" ? body.senha : "";
  if (senha.length < 8 || senha.length > 200) {
    return NextResponse.json({ erro: "A nova senha deve ter entre 8 e 200 caracteres." }, { status: 400 });
  }
  if (apiOnlyMode()) {
    try {
      const response = await apiFetch("auth/senha", { method: "PUT", body: JSON.stringify({ senha }) });
      if (!response.ok) return NextResponse.json({ erro: response.status === 401 ?
        "Sessao expirada. Entre novamente." : "Nao foi possivel trocar a senha." }, { status: response.status });
      return NextResponse.json({ ok: true });
    } catch { return NextResponse.json({ erro: "API indisponivel." }, { status: 502 }); }
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha,
    data: { must_change_password: false } });
  if (error) return NextResponse.json({ erro: error.message || "Nao foi possivel trocar a senha." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
