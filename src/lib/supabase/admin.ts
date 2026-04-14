import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, assertServerEnv } from "@/lib/env";

// Service-role client. NEVER import from client components.
let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  assertServerEnv();
  if (_admin) return _admin;
  _admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
