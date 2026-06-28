import { createClient } from "@supabase/supabase-js";

/** Anonymous Supabase client for public, RLS-gated reads (no cookies). */
export function createPublicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
