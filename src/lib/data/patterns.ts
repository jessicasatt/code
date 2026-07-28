import { isSupabaseConfigured } from "../env";
import { createServerSupabaseClient } from "../supabase/server";
import { getDemoState } from "../demo/store";
import { formatAppTime, startOfAppWeek } from "../date/timezone";
import { computeBlockCompletionRate, computeRecoveryRate, summarizeInterruptionReasons } from "../domain/behavioral-metrics";
import type { BehavioralCheckinReason, WorkBlockStatus } from "../domain/types";

/** Minimum sample size before a pattern card is shown at all. */
const MIN_SAMPLE = 3;
const LOOKBACK_DAYS = 30;

export interface PatternsSnapshot {
  hasAnyPattern: boolean;
  blockCompletion: { pct: number; sampleSize: number } | null;
  recovery: { pct: number; sampleSize: number } | null;
  topInterruptionReason: { reason: BehavioralCheckinReason; count: number; totalCheckins: number } | null;
  callsBeforeNoon: { pct: number; sampleSize: number } | null;
}

function buildSnapshot(params: {
  blocks: { status: WorkBlockStatus; callTarget: number; callsCompleted: number }[];
  checkins: { reason: BehavioralCheckinReason; resumedWithin60Min: boolean | null }[];
  weekCallStartTimes: string[];
}): PatternsSnapshot {
  const { blocks, checkins, weekCallStartTimes } = params;

  const blockCompletion =
    blocks.length >= MIN_SAMPLE
      ? (() => {
          const result = computeBlockCompletionRate(blocks);
          return result ? { pct: Math.round(result.rate * 100), sampleSize: result.sampleSize } : null;
        })()
      : null;

  const resolvedCheckins = checkins.filter((c) => c.resumedWithin60Min !== null);
  const recovery =
    resolvedCheckins.length >= MIN_SAMPLE
      ? (() => {
          const result = computeRecoveryRate(resolvedCheckins.map((c) => ({ resumed: c.resumedWithin60Min === true })));
          return result ? { pct: Math.round(result.rate * 100), sampleSize: result.sampleSize } : null;
        })()
      : null;

  const reasonCounts = summarizeInterruptionReasons(checkins);
  const topInterruptionReason =
    checkins.length >= MIN_SAMPLE && reasonCounts.length > 0
      ? { reason: reasonCounts[0].reason, count: reasonCounts[0].count, totalCheckins: checkins.length }
      : null;

  const callsBeforeNoon =
    weekCallStartTimes.length >= MIN_SAMPLE
      ? (() => {
          const beforeNoon = weekCallStartTimes.filter((t) => Number(formatAppTime(new Date(t), "H")) < 12).length;
          return { pct: Math.round((beforeNoon / weekCallStartTimes.length) * 100), sampleSize: weekCallStartTimes.length };
        })()
      : null;

  return {
    hasAnyPattern: Boolean(blockCompletion || recovery || topInterruptionReason || callsBeforeNoon),
    blockCompletion,
    recovery,
    topInterruptionReason,
    callsBeforeNoon,
  };
}

export async function getPatternsSnapshot(userId: string, now: Date = new Date()): Promise<PatternsSnapshot> {
  const weekStart = startOfAppWeek(now).toISOString();
  const lookbackStart = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60_000).toISOString();

  if (!isSupabaseConfigured()) {
    const state = getDemoState();
    const blocks = state.workBlocks
      .filter((b) => b.status !== "active" && new Date(b.createdAt).getTime() >= new Date(lookbackStart).getTime())
      .map((b) => ({ status: b.status, callTarget: b.callTarget, callsCompleted: b.callsCompleted }));
    const checkins = state.behavioralCheckins
      .filter((c) => new Date(c.createdAt).getTime() >= new Date(lookbackStart).getTime())
      .map((c) => ({ reason: c.reason, resumedWithin60Min: c.resumedWithin60Min }));
    const weekCallStartTimes = state.callEvents
      .filter((c) => c.direction === "outbound" && new Date(c.startTime).getTime() >= new Date(weekStart).getTime())
      .map((c) => c.startTime);
    return buildSnapshot({ blocks, checkins, weekCallStartTimes });
  }

  const supabase = await createServerSupabaseClient();
  const [{ data: blockRows }, { data: checkinRows }, { data: weekCallRows }] = await Promise.all([
    supabase
      .from("work_blocks")
      .select("status, call_target, calls_completed")
      .eq("user_id", userId)
      .neq("status", "active")
      .gte("created_at", lookbackStart),
    supabase
      .from("behavioral_checkins")
      .select("reason, resumed_within_60_min")
      .eq("user_id", userId)
      .gte("created_at", lookbackStart),
    supabase
      .from("call_events")
      .select("start_time")
      .eq("user_id", userId)
      .eq("direction", "outbound")
      .gte("start_time", weekStart),
  ]);

  return buildSnapshot({
    blocks: (blockRows ?? []).map((b) => ({ status: b.status, callTarget: b.call_target, callsCompleted: b.calls_completed })),
    checkins: (checkinRows ?? []).map((c) => ({ reason: c.reason, resumedWithin60Min: c.resumed_within_60_min })),
    weekCallStartTimes: (weekCallRows ?? []).map((c) => c.start_time),
  });
}
