import "server-only";
import { getNotificationPreferences } from "../data/notification-preferences";
import { createServerSupabaseClient } from "../supabase/server";
import { isNotificationEligible, type NotificationCategory } from "../domain/notifications";
import { sendPushToUser } from "./send";

async function getQuietHours(userId: string): Promise<{ start: string; end: string }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("profiles").select("quiet_hours_start, quiet_hours_end").eq("user_id", userId).maybeSingle();
  return { start: data?.quiet_hours_start ?? "20:00", end: data?.quiet_hours_end ?? "07:00" };
}

/** Checks category preference + quiet hours before sending, and logs the attempt either way via sendPushToUser. */
export async function notifyUser(
  userId: string,
  category: NotificationCategory,
  payload: { title: string; body: string; deepLink?: string },
): Promise<void> {
  const [preferences, quietHours] = await Promise.all([getNotificationPreferences(userId), getQuietHours(userId)]);
  const eligible = isNotificationEligible({ category, categoryEnabled: preferences[category], now: new Date(), quietHours });
  if (!eligible) return;
  await sendPushToUser(userId, { ...payload, category });
}
