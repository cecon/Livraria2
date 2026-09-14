import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// Encerra a sessão compartilhada e limpa quem estava logado.
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete("app_user");
  return NextResponse.json({ ok: true });
}
