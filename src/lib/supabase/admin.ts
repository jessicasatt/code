import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "../env";

/**
 * Service-role client that bypasses RLS. Used only by trusted server-only
 * code paths that must act outside a user's own session — the webhook
 * receiver (the caller has no user session to bind to) and scheduled jobs.
 * Never import this from anything reachable by a client bundle.
 */
export function createAdminSupabaseClient() {
  const pub = getPublicEnv();
  const server = getServerEnv();
  if (!pub.NEXT_PUBLIC_SUPABASE_URL || !server.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(pub.NEXT_PUBLIC_SUPABASE_URL, server.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
