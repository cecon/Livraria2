import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { apiOnlyMode } from "@/lib/api/server";

// Encerra a sessão compartilhada e limpa quem estava logado.
export async function POST() {
  if (!apiOnlyMode()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  (await cookies()).delete("app_user");
  (await cookies()).delete("nuvem_usuario");
  return NextResponse.json({ ok: true });
}
