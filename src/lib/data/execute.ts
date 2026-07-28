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
import { isInactiveDuringActiveBlock, INACTIVITY_THRESHOLD_MINUTES } from "../domain/notifications";
import {
  DEFAULT_BLOCK_SIZING_CONFIG,
  determineSuggestedBlockMode,
  estimateBlockMinutes,
  suggestBlockSize,
  type PastBlockSummary,
  type SuggestedBlockMode,
} from "../domain/block-sizing";
import type { CoachingSettings, Goal, PaceStatus, Profile, WorkBlock } from "../domain/types";
import { isSupabaseConfigured } from "../env";
import { callsCompletedOn, followUpsDueCount, getDemoState } from "../demo/store";
import { createServerSupabaseClient } from "../supabase/server";
import { mapGoalRow, mapProfileRow, mapWorkBlockRow } from "./mappers";
import { getCoachingSettings } from "./coaching-settings";

export interface HighLevelSyncStatus {
  connected: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

export interface ExecuteSnapshot {
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
  isInactive: boolean;
  suggestedBlockMode: SuggestedBlockMode;
  suggestedBlockSize: number;
  suggestedBlockMinutes: number;
  paceStatus: PaceStatus;
  nextAction: NextAction;
  highLevelSync: HighLevelSyncStatus;
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
  lastBlockToday: PastBlockSummary | null;
  highLevelSync: HighLevelSyncStatus;
  coachingSettings: CoachingSettings;
}): ExecuteSnapshot {
  const { now, profile, goal, callsToday, callsThisWeek, activeWorkBlock, coachingSettings } = params;

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

  const isInactive = isInactiveDuringActiveBlock({
    blockStatus: activeWorkBlock?.status ?? "scheduled",
    lastActivityAt: activeWorkBlock?.lastActivityAt ? new Date(activeWorkBlock.lastActivityAt) : null,
    now,
    thresholdMinutes: coachingSettings.inactivityThresholdMinutes ?? INACTIVITY_THRESHOLD_MINUTES,
  });

  const suggestedBlockMode = determineSuggestedBlockMode(params.lastBlockToday);
  const suggestedBlockSize = suggestBlockSize(suggestedBlockMode, {
    ...DEFAULT_BLOCK_SIZING_CONFIG,
    normalBlockSize: coachingSettings.defaultBlockSize,
    highMomentumBlockSize: coachingSettings.defaultBlockSize,
  });
  const suggestedBlockMinutes = estimateBlockMinutes(suggestedBlockSize);

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
    isInactive,
    suggestedBlockMode,
    suggestedBlockSize,
    suggestedBlockMinutes,
    paceStatus,
    nextAction,
    highLevelSync: params.highLevelSync,
  };
}

function getExecuteSnapshotDemo(now: Date, coachingSettings: CoachingSettings): ExecuteSnapshot {
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

  const activeWorkBlock = state.workBlocks.find((b) => b.status === "active") ?? null;
  const pastBlocksToday = state.workBlocks
    .filter((b) => b.status !== "active" && new Date(b.createdAt).getTime() >= todayStart.getTime())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const lastBlockToday = pastBlocksToday[0]
    ? { status: pastBlocksToday[0].status, callTarget: pastBlocksToday[0].callTarget, callsCompleted: pastBlocksToday[0].callsCompleted }
    : null;

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
    activeWorkBlock,
    lastBlockToday,
    highLevelSync: { connected: false, lastSyncedAt: null, error: null },
    coachingSettings,
  });
}

async function getExecuteSnapshotSupabase(userId: string, now: Date, coachingSettings: CoachingSettings): Promise<ExecuteSnapshot> {
  const supabase = await createServerSupabaseClient();

  const [{ data: profileRow }, { data: goalRow }, { data: activeBlockRow }, { data: connectionRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("goals").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("work_blocks").select("*").eq("user_id", userId).eq("status", "active").maybeSingle(),
    supabase.from("highlevel_connections").select("connected, last_verified_at, error").eq("user_id", userId).maybeSingle(),
  ]);

  if (!profileRow || !goalRow) {
    throw new Error("Profile or goal not found. Onboarding must complete before the Execute screen can render.");
  }

  const profile = mapProfileRow(profileRow);
  const goal = mapGoalRow(goalRow);
  const activeWorkBlock = activeBlockRow ? mapWorkBlockRow(activeBlockRow) : null;

  const todayStart = startOfAppDay(now).toISOString();
  const todayEnd = endOfAppDay(now).toISOString();
  const weekStart = startOfAppWeek(now).toISOString();
  const weekEnd = endOfAppWeek(now).toISOString();

  const [
    { count: callsToday },
    { count: callsThisWeek },
    { data: todaysCalls },
    { count: appointmentsBooked },
    { count: followUpsDue },
    { data: lastBlockRow },
  ] = await Promise.all([
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
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "due"),
    supabase
      .from("work_blocks")
      .select("status, call_target, calls_completed")
      .eq("user_id", userId)
      .neq("status", "active")
      .gte("created_at", todayStart)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const humanAnswers = (todaysCalls ?? []).filter((c) => c.answered_status === "answered").length;
  const meaningfulConversations = (todaysCalls ?? []).filter((c) => c.meaningful_conversation).length;
  const lastBlockToday: PastBlockSummary | null = lastBlockRow
    ? { status: lastBlockRow.status, callTarget: lastBlockRow.call_target, callsCompleted: lastBlockRow.calls_completed }
    : null;

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
    lastBlockToday,
    highLevelSync: {
      connected: connectionRow?.connected ?? false,
      lastSyncedAt: connectionRow?.last_verified_at ?? null,
      error: connectionRow?.error ?? null,
    },
    coachingSettings,
  });
}

export async function getExecuteSnapshot(userId: string, now: Date = new Date()): Promise<ExecuteSnapshot> {
  const coachingSettings = await getCoachingSettings(userId);
  if (!isSupabaseConfigured()) {
    return getExecuteSnapshotDemo(now, coachingSettings);
  }
  return getExecuteSnapshotSupabase(userId, now, coachingSettings);
}
