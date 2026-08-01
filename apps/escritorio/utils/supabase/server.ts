import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requiredEnv } from "@/utils/env";

type CookieItem = { name: string; value: string; options: CookieOptions };

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

// Cliente Supabase para Server Components / Route Handlers (sessão por cookies).
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieItem[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Chamado de um Server Component — ignorável quando há middleware
          // atualizando a sessão.
        }
      },
    },
  });
}
