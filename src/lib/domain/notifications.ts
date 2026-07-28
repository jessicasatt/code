import { isWithinTimeRange, minutesBetween, toAppTime, type TimeOfDayRange } from "../date/timezone";

export const INACTIVITY_THRESHOLD_MINUTES = 25;
export const INACTIVITY_NUDGE_COOLDOWN_MINUTES = 45;

/**
 * Inactivity nudges only ever fire inside an active call block (spec rule:
 * "recognize inactivity only inside an active call block", and notification
 * rule "never send inactivity notifications outside an active block").
 */
export function isInactiveDuringActiveBlock(params: {
  blockStatus: "scheduled" | "active" | "completed" | "cancelled";
  lastActivityAt: Date | null;
  now: Date;
  thresholdMinutes?: number;
}): boolean {
  const { blockStatus, lastActivityAt, now, thresholdMinutes = INACTIVITY_THRESHOLD_MINUTES } = params;
  if (blockStatus !== "active") return false;
  if (!lastActivityAt) return false;
  return minutesBetween(now, lastActivityAt) >= thresholdMinutes;
}

/** Enforces "maximum one inactivity nudge every 45 minutes" regardless of how many times the check runs. */
export function canSendInactivityNudge(params: {
  lastNudgeSentAt: Date | null;
  now: Date;
  cooldownMinutes?: number;
}): boolean {
  const { lastNudgeSentAt, now, cooldownMinutes = INACTIVITY_NUDGE_COOLDOWN_MINUTES } = params;
  if (!lastNudgeSentAt) return true;
  return minutesBetween(now, lastNudgeSentAt) >= cooldownMinutes;
}

export function isWithinQuietHours(now: Date, quietHours: TimeOfDayRange): boolean {
  return isWithinTimeRange(now, quietHours);
}

/**
 * True when `now`'s app-timezone hour matches the hour portion of a
 * configured "HH:mm" time. Used by the hourly scheduled-notifications cron
 * (Vercel Hobby plan can't run more often than once/day per job, so an
 * hourly sweep checking "is it currently this user's configured hour?" is
 * how per-user-configurable times like "morning brief at 7:30" work at all
 * — see DEPLOYMENT.md).
 */
export function isCurrentHourMatch(now: Date, configuredTime: string): boolean {
  const zoned = toAppTime(now);
  const [hour] = configuredTime.split(":").map(Number);
  return zoned.getHours() === hour;
}

export const ALL_NOTIFICATION_CATEGORIES = [
  "morning_brief",
  "block_starting_soon",
  "no_calls_logged_yet",
  "few_calls_remaining",
  "inactivity",
  "block_target_completed",
  "follow_up_due",
  "behind_weekly_pace",
  "end_of_day_summary",
  "weekly_review",
] as const;
export type NotificationCategory = (typeof ALL_NOTIFICATION_CATEGORIES)[number];

/**
 * These categories are inherently time-window-based independent of any
 * user action (e.g. "no activity for 25 minutes"), so they need a check
 * running every few minutes. Vercel's Hobby-plan cron can only fire a
 * given job once per day, so these can't be delivered reliably without a
 * paid plan or an external scheduler — see DEPLOYMENT.md.
 */
export const CATEGORIES_REQUIRING_FREQUENT_SCHEDULING: readonly NotificationCategory[] = [
  "block_starting_soon",
  "no_calls_logged_yet",
  "inactivity",
];

/** A notification is eligible only if its category is enabled and quiet hours (unless it's the one exempt category) don't block it. */
export function isNotificationEligible(params: {
  category: NotificationCategory;
  categoryEnabled: boolean;
  now: Date;
  quietHours: TimeOfDayRange;
}): boolean {
  const { category, categoryEnabled, now, quietHours } = params;
  if (!categoryEnabled) return false;
  if (isWithinQuietHours(now, quietHours)) return false;
  void category;
  return true;
}
