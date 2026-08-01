import { createBrowserClient } from "@supabase/ssr";
import { cleanEnv } from "@/utils/env";

const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

// Cliente Supabase para Client Components (browser).
export function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase nao configurado no cliente");
  }
  return createBrowserClient(supabaseUrl, supabaseKey);
}
