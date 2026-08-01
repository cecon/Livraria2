import { createBrowserClient } from "@supabase/ssr";
import { requiredEnv } from "@/utils/env";

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

// Cliente Supabase para Client Components (browser).
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
