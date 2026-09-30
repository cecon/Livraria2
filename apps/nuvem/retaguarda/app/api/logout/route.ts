import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const store = await cookies();
  store.delete("app_user");
  store.delete("nuvem_usuario");
  return NextResponse.json({ ok: true });
}
