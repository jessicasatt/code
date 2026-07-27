import {
  calculateCallsRemainingToday,
  calculateClientsNeeded,
  calculateElapsedFractionOfCallingHours,
  calculateExpectedCallsByNow,
  calculatePaceStatus,
  calculateRemainingMrr,
  calculateRequiredDailyPace,
  calculateWeeklyCallsRemaining,
} from "../domain/revenue";
import { buildNextAction, type NextAction } from "../domain/next-action";
import { endOfAppDay, endOfAppWeek, remainingWorkdaysInWeek, startOfAppDay, startOfAppWeek } from "../date/timezone";
import type { Goal, PaceStatus, Profile, WorkBlock } from "../domain/types";
import { isSupabaseConfigured } from "../env";
import { callsCompletedOn, followUpsDueCount, getDemoState } from "../demo/store";
import { createServerSupabaseClient } from "../supabase/server";
import { mapGoalRow, mapProfileRow, mapWorkBlockRow } from "./mappers";

export interface TodaySnapshot {
  profile: Profile;
  goal: Goal;
  remainingMrrCents: number;
  clientsNeeded: number;
  callsToday: number;
  dailyCallTarget: number;
  callsThisWeek: number;
  weeklyCallTarget: number;
  weeklyCallsRemaining: number;
  requiredDailyPace: number;
  humanAnswers: number | null;
  meaningfulConversations: number;
  appointmentsBooked: number;
  followUpsDue: number;
  activeWorkBlock: WorkBlock | null;
  paceStatus: PaceStatus;
  nextAction: NextAction;
}

function buildSnapshot(params: {
  now: Date;
  profile: Profile;
  goal: Goal;
  callsToday: number;
  callsThisWeek: number;
  humanAnswers: number | null;
  meaningfulConversations: number;
  appointmentsBooked: number;
  followUpsDue: number;
  activeWorkBlock: WorkBlock | null;
}): TodaySnapshot {
  const { now, profile, goal, callsToday, callsThisWeek, activeWorkBlock } = params;

  const remainingMrrCents = calculateRemainingMrr(goal.monthlyRevenueGoalCents, goal.currentMrrCents);
  const clientsNeeded = calculateClientsNeeded(remainingMrrCents, goal.averageClientValueCents);
  const weeklyCallsRemaining = calculateWeeklyCallsRemaining(goal.weeklyCallTarget, callsThisWeek);
  const remainingWorkdays = remainingWorkdaysInWeek(now, profile.workdays);
  const requiredDailyPace = calculateRequiredDailyPace(weeklyCallsRemaining, remainingWorkdays);

  const elapsedFraction = calculateElapsedFractionOfCallingHours(now, {
    start: profile.callingHoursStart,
    end: profile.callingHoursEnd,
  });
  const expectedByNow = calculateExpectedCallsByNow(goal.dailyCallTarget, elapsedFraction);
  const paceStatus = calculatePaceStatus(callsToday, expectedByNow);
  const callsRemainingToday = calculateCallsRemainingToday(goal.dailyCallTarget, callsToday);

  const nextAction = buildNextAction({
    now,
    callsRemainingToday,
    activeWorkBlock: activeWorkBlock
      ? {
          callsRemaining: Math.max(0, activeWorkBlock.callTarget - activeWorkBlock.callsCompleted),
          plannedEnd: activeWorkBlock.plannedEnd,
        }
      : null,
    followUpsDue: params.followUpsDue,
  });

  return {
    profile,
    goal,
    remainingMrrCents,
    clientsNeeded,
    callsToday,
    dailyCallTarget: goal.dailyCallTarget,
    callsThisWeek,
    weeklyCallTarget: goal.weeklyCallTarget,
    weeklyCallsRemaining,
    requiredDailyPace,
    humanAnswers: params.humanAnswers,
    meaningfulConversations: params.meaningfulConversations,
    appointmentsBooked: params.appointmentsBooked,
    followUpsDue: params.followUpsDue,
    activeWorkBlock,
    paceStatus,
    nextAction,
  };
}

function getTodaySnapshotDemo(now: Date): TodaySnapshot {
  const state = getDemoState();
  const callsToday = callsCompletedOn(state, now);
  const weekStart = startOfAppWeek(now);
  const weekEnd = endOfAppWeek(now);
  const callsThisWeek = state.callEvents.filter((c) => {
    const t = new Date(c.startTime).getTime();
    return t >= weekStart.getTime() && t <= weekEnd.getTime();
  }).length;

  const todayStart = startOfAppDay(now);
  const todayEnd = endOfAppDay(now);
  const todaysCalls = state.callEvents.filter((c) => {
    const t = new Date(c.startTime).getTime();
    return t >= todayStart.getTime() && t <= todayEnd.getTime();
  });

  return buildSnapshot({
    now,
    profile: state.profile,
    goal: state.goal,
    callsToday,
    callsThisWeek,
    humanAnswers: todaysCalls.filter((c) => c.answeredStatus === "answered").length,
    meaningfulConversations: todaysCalls.filter((c) => c.meaningfulConversation).length,
    appointmentsBooked: state.appointments.length,
    followUpsDue: followUpsDueCount(state),
    activeWorkBlock: state.workBlocks.find((b) => b.status === "active") ?? null,
  });
}

async function getTodaySnapshotSupabase(userId: string, now: Date): Promise<TodaySnapshot> {
  const supabase = await createServerSupabaseClient();

  const [{ data: profileRow }, { data: goalRow }, { data: activeBlockRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("goals").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("work_blocks").select("*").eq("user_id", userId).eq("status", "active").maybeSingle(),
  ]);

  if (!profileRow || !goalRow) {
    throw new Error("Profile or goal not found. Onboarding must complete before the Today screen can render.");
  }

  const profile = mapProfileRow(profileRow);
  const goal = mapGoalRow(goalRow);
  const activeWorkBlock = activeBlockRow ? mapWorkBlockRow(activeBlockRow) : null;

  const todayStart = startOfAppDay(now).toISOString();
  const todayEnd = endOfAppDay(now).toISOString();
  const weekStart = startOfAppWeek(now).toISOString();
  const weekEnd = endOfAppWeek(now).toISOString();

  const [{ count: callsToday }, { count: callsThisWeek }, { data: todaysCalls }, { count: appointmentsBooked }, { count: followUpsDue }] =
    await Promise.all([
      supabase
        .from("call_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("start_time", todayStart)
        .lte("start_time", todayEnd),
      supabase
        .from("call_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("start_time", weekStart)
        .lte("start_time", weekEnd),
      supabase
        .from("call_events")
        .select("answered_status, meaningful_conversation")
        .eq("user_id", userId)
        .gte("start_time", todayStart)
        .lte("start_time", todayEnd),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("follow_ups")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "due"),
    ]);

  const humanAnswers = (todaysCalls ?? []).filter((c) => c.answered_status === "answered").length;
  const meaningfulConversations = (todaysCalls ?? []).filter((c) => c.meaningful_conversation).length;

  return buildSnapshot({
    now,
    profile,
    goal,
    callsToday: callsToday ?? 0,
    callsThisWeek: callsThisWeek ?? 0,
    humanAnswers,
    meaningfulConversations,
    appointmentsBooked: appointmentsBooked ?? 0,
    followUpsDue: followUpsDue ?? 0,
    activeWorkBlock,
  });
}

export async function getTodaySnapshot(userId: string, now: Date = new Date()): Promise<TodaySnapshot> {
  if (!isSupabaseConfigured()) {
    return getTodaySnapshotDemo(now);
  }
  return getTodaySnapshotSupabase(userId, now);
}
