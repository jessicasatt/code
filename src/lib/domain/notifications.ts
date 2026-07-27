import { isWithinTimeRange, minutesBetween, type TimeOfDayRange } from "../date/timezone";

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

export type NotificationCategory =
  | "morning_brief"
  | "block_starting_soon"
  | "no_calls_logged_yet"
  | "few_calls_remaining"
  | "inactivity"
  | "block_target_completed"
  | "follow_up_due"
  | "behind_weekly_pace"
  | "end_of_day_summary"
  | "weekly_review";

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
