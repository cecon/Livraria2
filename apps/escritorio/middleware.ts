import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Roda em tudo menos assets estáticos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
