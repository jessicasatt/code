import "server-only";
import { getNotificationPreferences } from "../data/notification-preferences";
import { createServerSupabaseClient } from "../supabase/server";
import { canSendInactivityNudge, isNotificationEligible, type NotificationCategory } from "../domain/notifications";
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

/**
 * Called from the on-demand HighLevel sync path (POST /api/highlevel/sync-now)
 * the instant it detects an active block has gone inactive, using the same
 * live call_events data the Execute screen itself just refreshed from —
 * never a stale end-of-day snapshot. Still respects the standing
 * once-per-45-minutes cooldown (via notification_deliveries) and
 * notifyUser's own category-enabled + quiet-hours checks.
 */
export async function notifyInactivityIfEligible(
  userId: string,
  now: Date = new Date(),
  cooldownMinutes?: number,
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data: lastNudge } = await supabase
    .from("notification_deliveries")
    .select("sent_at")
    .eq("user_id", userId)
    .eq("category", "inactivity")
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cooldownOk = canSendInactivityNudge({
    lastNudgeSentAt: lastNudge?.sent_at ? new Date(lastNudge.sent_at) : null,
    now,
    cooldownMinutes,
  });
  if (!cooldownOk) return false;

  await notifyUser(userId, "inactivity", {
    title: "Paused",
    body: "You paused during your block. Restart with one call.",
    deepLink: "/execute",
  });
  return true;
}
