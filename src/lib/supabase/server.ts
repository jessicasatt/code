import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "../env";

/**
 * Server-side Supabase client bound to the request's cookies, so every
 * query runs as the signed-in user and RLS enforces ownership naturally.
 * Next.js 16 requires cookies() to be awaited.
 */
export async function createServerSupabaseClient() {
  const env = getPublicEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured. This should only be called when isSupabaseConfigured() is true.");
  }
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render; the proxy (middleware)
          // refreshes the session cookie instead. Safe to ignore.
        }
      },
    },
  });
}
