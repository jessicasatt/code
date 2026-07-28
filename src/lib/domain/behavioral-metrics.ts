import { minutesBetween } from "../date/timezone";
import type { AnsweredStatus, BehavioralCheckinReason, WorkBlockStatus } from "./types";

/**
 * Pure, deterministic behavioral-metrics calculations. These describe what
 * happened — they never claim why, and every result carries its sample
 * size so a caller can decide whether there's enough evidence to show it.
 * No psychological claims are made anywhere in this file.
 */

export interface RateResult {
  rate: number;
  sampleSize: number;
}

/** Minutes between a block starting and its first recorded call. Null if no call has happened yet. */
export function computeActivationMinutes(sample: { blockStartedAt: string; firstCallAt: string | null }): number | null {
  if (!sample.firstCallAt) return null;
  return minutesBetween(new Date(sample.firstCallAt), new Date(sample.blockStartedAt));
}

/** Minutes between an inactivity check-in and the next call after it. Null if no call followed. */
export function computeRestartMinutes(sample: { checkinAt: string; nextCallAt: string | null }): number | null {
  if (!sample.nextCallAt) return null;
  return minutesBetween(new Date(sample.nextCallAt), new Date(sample.checkinAt));
}

/** Fraction of interrupted blocks (those with a check-in) that recorded at least one more call afterward. */
export function computeRecoveryRate(samples: { resumed: boolean }[]): RateResult | null {
  if (samples.length === 0) return null;
  const resumed = samples.filter((s) => s.resumed).length;
  return { rate: resumed / samples.length, sampleSize: samples.length };
}

/** Fraction of started blocks that reached their full call target. */
export function computeBlockCompletionRate(
  blocks: { status: WorkBlockStatus; callsCompleted: number; callTarget: number }[],
): RateResult | null {
  if (blocks.length === 0) return null;
  const completed = blocks.filter((b) => b.status === "completed" && b.callsCompleted >= b.callTarget).length;
  return { rate: completed / blocks.length, sampleSize: blocks.length };
}

export interface InterruptionReasonCount {
  reason: BehavioralCheckinReason;
  count: number;
}

/** Counts of user-selected interruption reasons, most common first. Never inferred — only what the user tapped. */
export function summarizeInterruptionReasons(checkins: { reason: BehavioralCheckinReason }[]): InterruptionReasonCount[] {
  const counts = new Map<BehavioralCheckinReason, number>();
  for (const c of checkins) counts.set(c.reason, (counts.get(c.reason) ?? 0) + 1);
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

export interface InterventionEffectiveness {
  sampleSize: number;
  resumedWithin10MinRate: number | null;
  resumedWithin30MinRate: number | null;
  resumedWithin60MinRate: number | null;
}

/** How often a restart nudge was followed by a call within 10/30/60 minutes, over check-ins that have been resolved either way. */
export function computeInterventionEffectiveness(
  samples: { resumedWithin10Min: boolean | null; resumedWithin30Min: boolean | null; resumedWithin60Min: boolean | null }[],
): InterventionEffectiveness {
  const resolved = samples.filter((s) => s.resumedWithin60Min !== null);
  if (resolved.length === 0) {
    return { sampleSize: 0, resumedWithin10MinRate: null, resumedWithin30MinRate: null, resumedWithin60MinRate: null };
  }
  return {
    sampleSize: resolved.length,
    resumedWithin10MinRate: resolved.filter((s) => s.resumedWithin10Min === true).length / resolved.length,
    resumedWithin30MinRate: resolved.filter((s) => s.resumedWithin30Min === true).length / resolved.length,
    resumedWithin60MinRate: resolved.filter((s) => s.resumedWithin60Min === true).length / resolved.length,
  };
}

/** Fraction of calls with a given outcome that were followed by another call afterward. */
export function computeCallRateAfterOutcome(
  samples: { answeredStatus: AnsweredStatus; nextCallHappened: boolean }[],
  outcome: AnsweredStatus,
): RateResult | null {
  const filtered = samples.filter((s) => s.answeredStatus === outcome);
  if (filtered.length === 0) return null;
  const continued = filtered.filter((s) => s.nextCallHappened).length;
  return { rate: continued / filtered.length, sampleSize: filtered.length };
}

export interface CheckinResumption {
  resumedWithin10Min: boolean;
  resumedWithin30Min: boolean;
  resumedWithin60Min: boolean;
}

/** Given when a check-in happened and when the next call landed, derives the three resumption windows. */
export function resolveCheckinResumption(checkinCreatedAt: Date, callAt: Date): CheckinResumption {
  const minutes = minutesBetween(callAt, checkinCreatedAt);
  return {
    resumedWithin10Min: minutes <= 10,
    resumedWithin30Min: minutes <= 30,
    resumedWithin60Min: minutes <= 60,
  };
}
