import "server-only";
import { createAdminSupabaseClient } from "../supabase/admin";

/**
 * Jessica OS v1 is single-user. Server-to-server callers with no session of
 * their own (the webhook receiver, scheduled jobs) resolve "the owner" this
 * way instead of threading a user id through an unauthenticated request.
 */
export async function getSingleAppUserId(): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const {
    data: { users },
    error,
  } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw new Error(`Failed to resolve app owner: ${error.message}`);
  const user = users[0];
  if (!user) throw new Error("No signed-up user exists yet.");
  return user.id;
}
