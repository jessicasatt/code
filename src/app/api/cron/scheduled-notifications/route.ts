import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { getSingleAppUserId } from "@/lib/data/single-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/notifications/send";
import {
  ALL_NOTIFICATION_CATEGORIES,
  isCurrentHourMatch,
  isNotificationEligible,
  type NotificationCategory,
} from "@/lib/domain/notifications";
import {
  calculateRequiredDailyPace,
  calculateWeeklyCallsRemaining,
} from "@/lib/domain/revenue";
import { formatCentsAsUsd } from "@/lib/domain/money";
import { endOfAppDay, remainingWorkdaysInWeek, startOfAppDay, startOfAppWeek, toAppTime } from "@/lib/date/timezone";

/**
 * Fires hourly (24 entries in vercel.json, each individually within
 * Vercel Hobby's "once per job per day" cron limit — see DEPLOYMENT.md).
 * Checks every time-based notification type on each run; each one is
 * gated by "does the current hour match this user's configured time" and
 * "hasn't this already been sent today/this week", so the net effect is
 * still roughly once per day per category, just without needing a
 * dedicated cron entry per user-configurable time.
 */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await getSingleAppUserId();
  const supabase = createAdminSupabaseClient();
  const now = new Date();
  const sent: NotificationCategory[] = [];

  const [{ data: profile }, { data: goal }, { data: preferenceRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("goals").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("notification_preferences").select("category, enabled").eq("user_id", userId),
  ]);

  if (!profile || !goal) {
    return NextResponse.json({ ok: true, skipped: "Onboarding not complete" });
  }

  const enabledByCategory = new Map((preferenceRows ?? []).map((r) => [r.category as NotificationCategory, r.enabled as boolean]));
  const preferences = Object.fromEntries(
    ALL_NOTIFICATION_CATEGORIES.map((c) => [c, enabledByCategory.get(c) ?? true]),
  ) as Record<NotificationCategory, boolean>;
  const quietHours = { start: profile.quiet_hours_start, end: profile.quiet_hours_end };

  async function alreadySentSince(category: NotificationCategory, since: Date): Promise<boolean> {
    const { count } = await supabase
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("category", category)
      .eq("status", "sent")
      .gte("sent_at", since.toISOString());
    return (count ?? 0) > 0;
  }

  async function maybeSend(category: NotificationCategory, dueNow: boolean, dedupSince: Date, title: string, body: string, deepLink: string) {
    if (!dueNow) return;
    if (!isNotificationEligible({ category, categoryEnabled: preferences[category], now, quietHours })) return;
    if (await alreadySentSince(category, dedupSince)) return;
    const result = await sendPushToUser(userId, { title, body, deepLink, category });
    if (result.sent > 0) sent.push(category);
  }

  const todayStart = startOfAppDay(now);
  const weekStart = startOfAppWeek(now);

  // Morning brief: today's target + progress so far.
  await maybeSend(
    "morning_brief",
    isCurrentHourMatch(now, profile.morning_brief_time),
    todayStart,
    "Morning brief",
    `Today's target: ${goal.daily_call_target} calls. Let's go.`,
    "/today",
  );

  // End-of-day summary.
  const { count: callsToday } = await supabase
    .from("call_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("start_time", todayStart.toISOString())
    .lte("start_time", endOfAppDay(now).toISOString());
  await maybeSend(
    "end_of_day_summary",
    isCurrentHourMatch(now, profile.end_of_day_summary_time),
    todayStart,
    "End-of-day summary",
    `You completed ${callsToday ?? 0} of ${goal.daily_call_target} calls today.`,
    "/review",
  );

  // Behind weekly pace — checked once daily alongside the morning brief.
  const { count: callsThisWeek } = await supabase
    .from("call_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("start_time", weekStart.toISOString());
  const weeklyRemaining = calculateWeeklyCallsRemaining(goal.weekly_call_target, callsThisWeek ?? 0);
  const remainingWorkdays = remainingWorkdaysInWeek(now, profile.workdays ?? []);
  const requiredDailyPace = calculateRequiredDailyPace(weeklyRemaining, remainingWorkdays);
  const behindPace = weeklyRemaining > 0 && remainingWorkdays > 0 && requiredDailyPace > goal.daily_call_target;
  await maybeSend(
    "behind_weekly_pace",
    isCurrentHourMatch(now, profile.morning_brief_time) && behindPace,
    todayStart,
    "Behind weekly pace",
    `${weeklyRemaining} calls remaining this week — that's ${requiredDailyPace}/day to stay on pace.`,
    "/today",
  );

  // Follow-ups due — once-daily digest alongside the end-of-day summary.
  const { count: followUpsDue } = await supabase
    .from("follow_ups")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "due")
    .lte("due_at", now.toISOString());
  await maybeSend(
    "follow_up_due",
    isCurrentHourMatch(now, profile.end_of_day_summary_time) && (followUpsDue ?? 0) > 0,
    todayStart,
    "Follow-ups due",
    `${followUpsDue} follow-up${followUpsDue === 1 ? "" : "s"} due.`,
    "/today",
  );

  // Weekly review — Sunday evening, once per week.
  const zonedDay = toAppTime(now).getDay();
  await maybeSend(
    "weekly_review",
    zonedDay === 0 && isCurrentHourMatch(now, profile.end_of_day_summary_time),
    weekStart,
    "Weekly review",
    `${formatCentsAsUsd(goal.current_mrr_cents)} of ${formatCentsAsUsd(goal.monthly_revenue_goal_cents)} toward your goal this week.`,
    "/review",
  );

  return NextResponse.json({ ok: true, sent });
}
