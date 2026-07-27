import type { Cents } from "./money";
import type { PaceStatus } from "./types";
import { isWithinTimeRange, toAppTime, type TimeOfDayRange } from "../date/timezone";

/**
 * Deterministic revenue-goal and pace math. No AI, no probability
 * estimates — every function here returns a calculated metric derived
 * from recorded facts, never a guess.
 */

export function calculateRemainingMrr(goalCents: Cents, currentMrrCents: Cents): Cents {
  return Math.max(0, goalCents - currentMrrCents);
}

/** Number of additional clients needed at the given average value to close the remaining MRR gap. Ceil, never fractional clients. */
export function calculateClientsNeeded(remainingMrrCents: Cents, averageClientValueCents: Cents): number {
  if (remainingMrrCents <= 0) return 0;
  if (averageClientValueCents <= 0) return 0;
  return Math.ceil(remainingMrrCents / averageClientValueCents);
}

export function calculateWeeklyCallsRemaining(weeklyCallTarget: number, callsCompletedThisWeek: number): number {
  return Math.max(0, weeklyCallTarget - callsCompletedThisWeek);
}

/**
 * Required calls per remaining workday to still hit the weekly target.
 * When there are no workdays left this week, the remaining calls are all
 * due "today" rather than silently disappearing.
 */
export function calculateRequiredDailyPace(weeklyCallsRemaining: number, remainingWorkdays: number): number {
  if (weeklyCallsRemaining <= 0) return 0;
  if (remainingWorkdays <= 0) return weeklyCallsRemaining;
  return Math.ceil(weeklyCallsRemaining / remainingWorkdays);
}

export function calculateCallsRemainingToday(dailyCallTarget: number, callsCompletedToday: number): number {
  return Math.max(0, dailyCallTarget - callsCompletedToday);
}

/**
 * Fraction (0-1) of today's configured calling-hours window that has
 * elapsed as of `now`. Returns 0 before the window opens and 1 after it
 * closes, so pace expectations never exceed the daily target.
 */
export function calculateElapsedFractionOfCallingHours(now: Date, callingHours: TimeOfDayRange): number {
  const toMinutes = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return h * 60 + m;
  };
  const start = toMinutes(callingHours.start);
  const end = toMinutes(callingHours.end);
  const windowMinutes = end > start ? end - start : 0;
  if (windowMinutes <= 0) return 0;

  const zoned = toAppTime(now);
  const nowMinutes = zoned.getHours() * 60 + zoned.getMinutes();

  if (isWithinTimeRange(now, callingHours)) {
    const elapsed = nowMinutes - start;
    return Math.min(1, Math.max(0, elapsed / windowMinutes));
  }

  return nowMinutes < start ? 0 : 1;
}

export function calculateExpectedCallsByNow(dailyCallTarget: number, elapsedFraction: number): number {
  return dailyCallTarget * elapsedFraction;
}

const PACE_TOLERANCE_CALLS = 1;

/** Compares actual progress to the expected-by-now benchmark. Deliberately coarse (a 1-call band counts as "on pace") to avoid twitchy status changes. */
export function calculatePaceStatus(callsCompleted: number, expectedByNow: number): PaceStatus {
  const diff = callsCompleted - expectedByNow;
  if (diff <= -PACE_TOLERANCE_CALLS) return "behind";
  if (diff >= PACE_TOLERANCE_CALLS) return "ahead";
  return "on_pace";
}
