"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "../env";

/** Browser-side Supabase client. Only ever uses the public URL + anon key — RLS is what keeps this safe. */
export function createClient() {
  const env = getPublicEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured. This should only be called when isSupabaseConfigured() is true.");
  }
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
