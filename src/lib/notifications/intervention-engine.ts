import "server-only";
import { createAdminSupabaseClient } from "../supabase/admin";
import { getCurrentBehavioralState } from "../data/behavioral-state";
import { getCoachingSettings } from "../data/coaching-settings";
import { buildInterventionCopy } from "../domain/intervention-copy";
import { startOfDayInTimezone } from "../date/timezone";
import { isSupabaseConfigured } from "../env";
import { notifyUser } from "./triggers";

export interface InterventionResult {
  sent: boolean;
  state: string;
  reason: string;
}

/**
 * The proactive coaching send path (PROACTIVE_COACHING_AUDIT.md Phase 3.5):
 * determine the current behavioral state, decide whether it's worth
 * interrupting the user about, and if so, send exactly one notification —
 * respecting the daily cap and per-state cooldown, and recording the
 * outcome in `interventions` so effectiveness can be measured later.
 *
 * Called from two places: the on-demand HighLevel sync route (covers
 * inactive_mid_block while the Execute screen is open) and the hourly
 * scheduled-notifications cron (covers late_start/behind_pace/
 * daily_target_complete/data_stale, which need to be re-checked over the
 * course of the day even with the app closed — see the audit's cadence
 * decision: hourly only, no new infrastructure).
 */
export async function runInterventionEngine(userId: string, now: Date = new Date()): Promise<InterventionResult> {
  const coachingSettings = await getCoachingSettings(userId);
  const behavioralState = await getCurrentBehavioralState(userId, now);

  if (!behavioralState.eligibleForNotification) {
    return { sent: false, state: behavioralState.state, reason: "not eligible right now" };
  }

  const copy = buildInterventionCopy(behavioralState, coachingSettings.coachingIntensity);
  if (!copy) {
    return { sent: false, state: behavioralState.state, reason: "no intervention copy for this state" };
  }

  if (!isSupabaseConfigured()) {
    return { sent: false, state: behavioralState.state, reason: "demo mode" };
  }

  const supabase = createAdminSupabaseClient();
  const todayStart = startOfDayInTimezone(now, coachingSettings.timezone).toISOString();

  const [{ count: todayCount }, { data: lastOfKind }] = await Promise.all([
    supabase.from("interventions").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", todayStart),
    supabase
      .from("interventions")
      .select("created_at")
      .eq("user_id", userId)
      .eq("kind", behavioralState.state)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if ((todayCount ?? 0) >= coachingSettings.maxProactiveNotificationsPerDay) {
    return { sent: false, state: behavioralState.state, reason: "daily proactive notification limit reached" };
  }

  if (lastOfKind?.created_at) {
    const minutesSinceLast = Math.round((now.getTime() - new Date(lastOfKind.created_at).getTime()) / 60_000);
    if (minutesSinceLast < coachingSettings.notificationCooldownMinutes) {
      return { sent: false, state: behavioralState.state, reason: "cooldown active" };
    }
  }

  await notifyUser(userId, copy.category, { title: copy.title, body: copy.body, deepLink: "/execute" });

  await supabase.from("interventions").insert({
    user_id: userId,
    kind: behavioralState.state,
    payload: {
      severity: behavioralState.severity,
      reason: behavioralState.reason,
      recommendedPlaybook: behavioralState.recommendedPlaybook,
    },
  });

  return { sent: true, state: behavioralState.state, reason: "sent" };
}
