import { redirect } from "next/navigation";
import { DEMO_USER_ID } from "./demo/store";
import { isSupabaseConfigured } from "./env";
import { createServerSupabaseClient } from "./supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
  isDemo: boolean;
}

/** Server-only. In demo mode there is always exactly one "signed in" owner. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured()) {
    return { id: DEMO_USER_ID, email: null, isDemo: true };
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? null, isDemo: false };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return user;
}
