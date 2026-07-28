import "server-only";
import webpush, { WebPushError } from "web-push";
import { getPublicEnv, getServerEnv, isPushConfigured } from "../env";
import { createAdminSupabaseClient } from "../supabase/admin";
import type { NotificationCategory } from "../domain/notifications";

export interface PushPayload {
  title: string;
  body: string;
  deepLink?: string;
  category: NotificationCategory;
}

let vapidConfigured = false;
function ensureVapidConfigured() {
  if (vapidConfigured) return;
  const server = getServerEnv();
  const pub = getPublicEnv();
  webpush.setVapidDetails(server.VAPID_SUBJECT!, pub.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, server.VAPID_PRIVATE_KEY!);
  vapidConfigured = true;
}

/**
 * Sends a push notification to every subscription the user has registered
 * (usually one, but a phone + desktop both subscribing is normal), logging
 * one delivery record per attempt. Expired subscriptions (410/404 from the
 * push service) are deleted automatically.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!isPushConfigured()) return { sent: 0, failed: 0 };
  ensureVapidConfigured();

  const supabase = createAdminSupabaseClient();
  const { data: subscriptions } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: payload.title, body: payload.body, deepLink: payload.deepLink ?? "/execute" }),
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  await supabase.from("notification_deliveries").insert({
    user_id: userId,
    category: payload.category,
    title: payload.title,
    body: payload.body,
    deep_link: payload.deepLink ?? null,
    status: sent > 0 ? "sent" : "failed",
    sent_at: sent > 0 ? new Date().toISOString() : null,
    error: sent === 0 ? (subscriptions?.length ? "All subscriptions failed" : "No subscriptions registered") : null,
  });

  return { sent, failed };
}
