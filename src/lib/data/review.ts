import { isSupabaseConfigured } from "../env";
import { createServerSupabaseClient } from "../supabase/server";
import { getDemoState } from "../demo/store";
import { startOfAppDay, endOfAppDay } from "../date/timezone";
import { getExecuteSnapshot } from "./execute";

export interface ReviewSnapshot {
  callsToday: number;
  dailyCallTarget: number;
  humanAnswers: number | null;
  meaningfulConversations: number;
  appointmentsBooked: number;
  followUpsDue: number;
  remainingMrrCents: number;
  monthlyRevenueGoalCents: number;
  blocksStartedToday: number;
  blocksCompletedToday: number;
  resumedAfterCheckinToday: number;
  /** One fact about today, only shown when there's enough activity to say something meaningful. */
  factualObservation: string | null;
  /** One suggested next experiment, only shown when there's a real result behind it. */
  nextExperiment: string | null;
}

export async function getReviewSnapshot(userId: string, now: Date = new Date()): Promise<ReviewSnapshot> {
  const execute = await getExecuteSnapshot(userId, now);
  const todayStart = startOfAppDay(now).toISOString();
  const todayEnd = endOfAppDay(now).toISOString();

  let blocksStartedToday = 0;
  let blocksCompletedToday = 0;
  let resumedAfterCheckinToday = 0;

  if (!isSupabaseConfigured()) {
    const state = getDemoState();
    const todayStartMs = new Date(todayStart).getTime();
    const todayEndMs = new Date(todayEnd).getTime();
    const blocksToday = state.workBlocks.filter((b) => {
      const t = new Date(b.createdAt).getTime();
      return t >= todayStartMs && t <= todayEndMs;
    });
    blocksStartedToday = blocksToday.length;
    blocksCompletedToday = blocksToday.filter((b) => b.status === "completed" && b.callsCompleted >= b.callTarget).length;
    resumedAfterCheckinToday = state.behavioralCheckins.filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return t >= todayStartMs && t <= todayEndMs && c.resumedWithin60Min === true;
    }).length;
  } else {
    const supabase = await createServerSupabaseClient();
    const [{ data: blocksToday }, { count: resumedCount }] = await Promise.all([
      supabase
        .from("work_blocks")
        .select("status, call_target, calls_completed")
        .eq("user_id", userId)
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd),
      supabase
        .from("behavioral_checkins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("resumed_within_60_min", true)
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd),
    ]);
    blocksStartedToday = blocksToday?.length ?? 0;
    blocksCompletedToday = (blocksToday ?? []).filter((b) => b.status === "completed" && b.calls_completed >= b.call_target).length;
    resumedAfterCheckinToday = resumedCount ?? 0;
  }

  const factualObservation =
    blocksStartedToday >= 2
      ? `You completed ${execute.callsToday} call${execute.callsToday === 1 ? "" : "s"} across ${blocksStartedToday} separate starts today.`
      : null;

  const nextExperiment =
    resumedAfterCheckinToday > 0
      ? `Restarting with one call helped you resume ${resumedAfterCheckinToday} time${resumedAfterCheckinToday === 1 ? "" : "s"} today.`
      : null;

  return {
    callsToday: execute.callsToday,
    dailyCallTarget: execute.dailyCallTarget,
    humanAnswers: execute.humanAnswers,
    meaningfulConversations: execute.meaningfulConversations,
    appointmentsBooked: execute.appointmentsBooked,
    followUpsDue: execute.followUpsDue,
    remainingMrrCents: execute.remainingMrrCents,
    monthlyRevenueGoalCents: execute.goal.monthlyRevenueGoalCents,
    blocksStartedToday,
    blocksCompletedToday,
    resumedAfterCheckinToday,
    factualObservation,
    nextExperiment,
  };
}
