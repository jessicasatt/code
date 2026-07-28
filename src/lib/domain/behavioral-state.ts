import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { addDays, startOfDay } from "date-fns";
import { calculateElapsedFractionOfCallingHoursInTimezone, calculateExpectedCallsByNow } from "./revenue";
import type { WorkBlockStatus, Weekday } from "./types";

/**
 * Deterministic behavioral state engine (PROACTIVE_COACHING_AUDIT.md
 * Phase 3). Pure function: given today's facts, decide what's going on and
 * whether it's worth interrupting the user about it. No AI, no
 * probability — every branch here is a plain rule over recorded facts.
 *
 * The `timezone` input is honored directly (via date-fns-tz), independent
 * of the app-wide APP_TIMEZONE constant elsewhere in the codebase — see
 * PROACTIVE_COACHING_AUDIT.md for why that constant hasn't been fully
 * migrated to a per-user setting yet. This function doesn't wait for that
 * migration to be timezone-correct.
 */

export type BehavioralStateName =
  | "outside_work_hours"
  | "coaching_paused"
  | "data_stale"
  | "not_started"
  | "late_start"
  | "active_block"
  | "inactive_mid_block"
  | "behind_pace"
  | "recently_restarted"
  | "block_nearly_complete"
  | "block_complete"
  | "daily_target_complete"
  // Not in the original spec list: covers "no active block, some progress
  // made today, on or ahead of pace" — a real, common, non-problem state
  // that none of the above states honestly describe. Reusing e.g.
  // "behind_pace" for this would make the field lie. See the audit doc.
  | "on_track_between_blocks";

export type BehavioralSeverity = "none" | "low" | "medium" | "high";

export interface BehavioralState {
  state: BehavioralStateName;
  severity: BehavioralSeverity;
  reason: string;
  recommendedPlaybook: string | null;
  eligibleForNotification: boolean;
  nextEvaluationAt: string;
}

export interface BehavioralStateSchedule {
  workdays: Weekday[];
  callingHoursStart: string; // "HH:mm"
  callingHoursEnd: string; // "HH:mm"
  desiredFirstCallTime: string; // "HH:mm"
}

export interface BehavioralStateActiveBlock {
  status: WorkBlockStatus;
  callTarget: number;
  callsCompleted: number;
}

export interface BehavioralStateCompletedBlock {
  status: WorkBlockStatus;
  callTarget: number;
  callsCompleted: number;
}

export interface BehavioralStateSyncStatus {
  connected: boolean;
  lastSyncedAt: Date | null;
  error: string | null;
}

export interface DetermineBehavioralStateInput {
  now: Date;
  timezone: string;
  schedule: BehavioralStateSchedule;
  callsToday: number;
  activeBlock: BehavioralStateActiveBlock | null;
  lastCallAt: Date | null;
  firstCallAt: Date | null;
  dailyTarget: number;
  /** Today's ended blocks, most-recently-ended first. */
  completedBlocks: BehavioralStateCompletedBlock[];
  coachingPaused: boolean;
  syncStatus: BehavioralStateSyncStatus;
  /** Defaults mirror src/lib/domain/notifications.ts and block-sizing.ts. */
  inactivityThresholdMinutes?: number;
  behindPaceTolerancePct?: number;
  nearCompletionThreshold?: number;
  restartBlockSize?: number;
}

const DEFAULTS = {
  inactivityThresholdMinutes: 25,
  behindPaceTolerancePct: 20,
  nearCompletionThreshold: 3,
  restartBlockSize: 1,
};

const WEEKDAY_NAMES: Weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function timeStringToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function zonedWeekday(now: Date, timezone: string): Weekday {
  return WEEKDAY_NAMES[toZonedTime(now, timezone).getDay()];
}

function minutesOfDay(now: Date, timezone: string): number {
  const zoned = toZonedTime(now, timezone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

function isWithinRange(now: Date, timezone: string, startStr: string, endStr: string): boolean {
  const start = timeStringToMinutes(startStr);
  const end = timeStringToMinutes(endStr);
  const current = minutesOfDay(now, timezone);
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end; // crosses midnight
}

function minutesSince(now: Date, past: Date): number {
  return Math.max(0, Math.round((now.getTime() - past.getTime()) / 60_000));
}

/** Next occurrence (today or a future workday) of callingHoursStart, in UTC. */
function nextWorkWindowStart(now: Date, timezone: string, schedule: BehavioralStateSchedule): Date {
  const workdaySet = new Set(schedule.workdays);
  const zonedNow = toZonedTime(now, timezone);
  const todayStartMinutes = timeStringToMinutes(schedule.callingHoursStart);

  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidateZonedDay = startOfDay(addDays(zonedNow, dayOffset));
    const candidateWeekday = WEEKDAY_NAMES[candidateZonedDay.getDay()];
    if (!workdaySet.has(candidateWeekday)) continue;

    const candidateZoned = new Date(candidateZonedDay);
    candidateZoned.setHours(Math.floor(todayStartMinutes / 60), todayStartMinutes % 60, 0, 0);
    const candidateUtc = fromZonedTime(candidateZoned, timezone);

    if (candidateUtc.getTime() > now.getTime()) return candidateUtc;
  }

  // No workdays configured at all — fall back to a generic hourly recheck
  // rather than looping forever.
  return new Date(now.getTime() + 60 * 60_000);
}

function hourly(now: Date): string {
  return new Date(now.getTime() + 60 * 60_000).toISOString();
}

function soon(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

export function determineBehavioralState(input: DetermineBehavioralStateInput): BehavioralState {
  const {
    now,
    timezone,
    schedule,
    callsToday,
    activeBlock,
    lastCallAt,
    dailyTarget,
    completedBlocks,
    coachingPaused,
    syncStatus,
  } = input;

  const inactivityThresholdMinutes = input.inactivityThresholdMinutes ?? DEFAULTS.inactivityThresholdMinutes;
  const behindPaceTolerancePct = input.behindPaceTolerancePct ?? DEFAULTS.behindPaceTolerancePct;
  const nearCompletionThreshold = input.nearCompletionThreshold ?? DEFAULTS.nearCompletionThreshold;
  const restartBlockSize = input.restartBlockSize ?? DEFAULTS.restartBlockSize;

  if (coachingPaused) {
    return {
      state: "coaching_paused",
      severity: "none",
      reason: "Coaching is paused.",
      recommendedPlaybook: null,
      eligibleForNotification: false,
      nextEvaluationAt: hourly(now),
    };
  }

  const isWorkday = schedule.workdays.includes(zonedWeekday(now, timezone));
  const withinCallingHours = isWorkday && isWithinRange(now, timezone, schedule.callingHoursStart, schedule.callingHoursEnd);

  if (!withinCallingHours) {
    return {
      state: "outside_work_hours",
      severity: "none",
      reason: isWorkday ? "Outside today's calling hours." : "Not a scheduled calling day.",
      recommendedPlaybook: null,
      eligibleForNotification: false,
      nextEvaluationAt: nextWorkWindowStart(now, timezone, schedule).toISOString(),
    };
  }

  // Data staleness only means something while a block is supposed to be
  // actively syncing — no active block means no sync is expected right now.
  if (activeBlock?.status === "active") {
    const staleSync =
      Boolean(syncStatus.error) ||
      !syncStatus.connected ||
      !syncStatus.lastSyncedAt ||
      minutesSince(now, syncStatus.lastSyncedAt) > 10;
    if (staleSync) {
      return {
        state: "data_stale",
        severity: "low",
        reason: syncStatus.error
          ? `HighLevel sync error: ${syncStatus.error}`
          : "HighLevel activity hasn't synced recently.",
        recommendedPlaybook: "check_highlevel_connection",
        eligibleForNotification: true,
        nextEvaluationAt: soon(now, 5),
      };
    }
  }

  if (activeBlock?.status === "active") {
    const remaining = Math.max(0, activeBlock.callTarget - activeBlock.callsCompleted);

    if (remaining === 0) {
      return {
        state: "block_complete",
        severity: "low",
        reason: `Reached the block target of ${activeBlock.callTarget} calls.`,
        recommendedPlaybook: "celebrate_and_choose_next",
        eligibleForNotification: true,
        nextEvaluationAt: soon(now, 5),
      };
    }

    const inactiveMinutes = lastCallAt ? minutesSince(now, lastCallAt) : null;
    if (inactiveMinutes !== null && inactiveMinutes >= inactivityThresholdMinutes) {
      return {
        state: "inactive_mid_block",
        severity: inactiveMinutes >= inactivityThresholdMinutes * 2 ? "high" : "medium",
        reason: `No call recorded for ${inactiveMinutes} minutes during an active block.`,
        recommendedPlaybook: "restart_with_one_call",
        eligibleForNotification: true,
        nextEvaluationAt: soon(now, 5),
      };
    }

    if (remaining <= nearCompletionThreshold) {
      return {
        state: "block_nearly_complete",
        severity: "low",
        reason: `${remaining} call${remaining === 1 ? "" : "s"} remaining to finish this block.`,
        recommendedPlaybook: "finish_the_block",
        eligibleForNotification: true,
        nextEvaluationAt: soon(now, 5),
      };
    }

    return {
      state: "active_block",
      severity: "none",
      reason: "Block in progress, activity is recent.",
      recommendedPlaybook: null,
      eligibleForNotification: false,
      nextEvaluationAt: soon(now, 5),
    };
  }

  // No active block from here on.

  if (callsToday >= dailyTarget && dailyTarget > 0) {
    return {
      state: "daily_target_complete",
      severity: "none",
      reason: `Reached today's target of ${dailyTarget} calls.`,
      recommendedPlaybook: "celebrate_daily_target",
      eligibleForNotification: true,
      nextEvaluationAt: hourly(now),
    };
  }

  const lastCompletedBlock = completedBlocks[0] ?? null;
  const justCompletedRestart =
    lastCompletedBlock !== null &&
    lastCompletedBlock.status === "completed" &&
    lastCompletedBlock.callTarget <= restartBlockSize &&
    lastCompletedBlock.callsCompleted >= lastCompletedBlock.callTarget;
  if (justCompletedRestart) {
    return {
      state: "recently_restarted",
      severity: "none",
      reason: "Just completed a restart block successfully.",
      recommendedPlaybook: "encourage_momentum",
      eligibleForNotification: false,
      nextEvaluationAt: soon(now, 15),
    };
  }

  if (callsToday === 0) {
    const desiredStartMinutes = timeStringToMinutes(schedule.desiredFirstCallTime);
    const currentMinutes = minutesOfDay(now, timezone);
    const minutesPastDesiredStart = currentMinutes - desiredStartMinutes;

    if (minutesPastDesiredStart < 0) {
      return {
        state: "not_started",
        severity: "none",
        reason: "No calls yet today, still before the desired first-call time.",
        recommendedPlaybook: null,
        eligibleForNotification: false,
        nextEvaluationAt: hourly(now),
      };
    }

    return {
      state: "late_start",
      severity: minutesPastDesiredStart >= 90 ? "high" : minutesPastDesiredStart >= 30 ? "medium" : "low",
      reason: `No calls yet today, ${minutesPastDesiredStart} minutes past the desired first-call time.`,
      recommendedPlaybook: "prompt_first_call",
      eligibleForNotification: true,
      nextEvaluationAt: hourly(now),
    };
  }

  const elapsedFraction = calculateElapsedFractionOfCallingHoursInTimezone(now, timezone, {
    start: schedule.callingHoursStart,
    end: schedule.callingHoursEnd,
  });
  const expectedByNow = calculateExpectedCallsByNow(dailyTarget, elapsedFraction);
  const toleranceCalls = expectedByNow * (behindPaceTolerancePct / 100);
  const isBehindPace = callsToday < expectedByNow - toleranceCalls;

  if (isBehindPace) {
    const deficit = Math.round(expectedByNow - callsToday);
    return {
      state: "behind_pace",
      severity: deficit >= dailyTarget * 0.4 ? "high" : "medium",
      reason: `${callsToday} calls so far, expected about ${Math.round(expectedByNow)} by now.`,
      recommendedPlaybook: "suggest_smaller_block",
      eligibleForNotification: true,
      nextEvaluationAt: hourly(now),
    };
  }

  return {
    state: "on_track_between_blocks",
    severity: "none",
    reason: "On pace, no block currently active.",
    recommendedPlaybook: null,
    eligibleForNotification: false,
    nextEvaluationAt: hourly(now),
  };
}
