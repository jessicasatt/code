import { isSupabaseConfigured } from "../env";
import { getDemoState, setDemoNotificationPreference } from "../demo/store";
import { ALL_NOTIFICATION_CATEGORIES, type NotificationCategory } from "../domain/notifications";
import { createServerSupabaseClient } from "../supabase/server";

export type NotificationPreferences = Record<NotificationCategory, boolean>;

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  if (!isSupabaseConfigured()) {
    return { ...getDemoState().notificationPreferences };
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("notification_preferences").select("category, enabled").eq("user_id", userId);

  const enabledByCategory = new Map((data ?? []).map((row) => [row.category as NotificationCategory, row.enabled as boolean]));
  const preferences = {} as NotificationPreferences;
  for (const category of ALL_NOTIFICATION_CATEGORIES) {
    // No row yet means never explicitly changed — defaults to enabled, matching the table's own column default.
    preferences[category] = enabledByCategory.get(category) ?? true;
  }
  return preferences;
}

export async function setNotificationPreference(userId: string, category: NotificationCategory, enabled: boolean): Promise<void> {
  if (!isSupabaseConfigured()) {
    setDemoNotificationPreference(category, enabled);
    return;
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, category, enabled }, { onConflict: "user_id,category" });
  if (error) throw new Error(error.message);
}

/** Number of devices currently subscribed to push for this user (0 = notifications effectively off regardless of category toggles). */
export async function getPushSubscriptionCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return getDemoState().pushSubscriptionCount;
  }
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}
