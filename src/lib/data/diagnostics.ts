import { isHighLevelConfigured, isSupabaseConfigured } from "../env";
import { createServerSupabaseClient } from "../supabase/server";

export interface HighLevelDiagnostics {
  configured: boolean;
  connected: boolean;
  lastVerifiedAt: string | null;
  error: string | null;
}

/**
 * Technical HighLevel connection detail, kept off the user-facing Pipeline
 * screen and surfaced only here (Settings > Diagnostics) per the product
 * direction: friendly copy on the main screens, raw detail in one place
 * for when something needs debugging.
 */
export async function getHighLevelDiagnostics(userId: string): Promise<HighLevelDiagnostics> {
  if (!isHighLevelConfigured()) {
    return { configured: false, connected: false, lastVerifiedAt: null, error: null };
  }

  if (!isSupabaseConfigured()) {
    return { configured: true, connected: true, lastVerifiedAt: null, error: null };
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("highlevel_connections")
    .select("connected, last_verified_at, error")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    configured: true,
    connected: data?.connected ?? false,
    lastVerifiedAt: data?.last_verified_at ?? null,
    error: data?.error ?? null,
  };
}
