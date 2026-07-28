import "server-only";
import { createAdminSupabaseClient } from "../supabase/admin";
import { getDemoState } from "../demo/store";
import { isSupabaseConfigured } from "../env";
import { determineBehavioralState, type BehavioralState, type BehavioralStateCompletedBlock } from "../domain/behavioral-state";
import { getCoachingSettings, isCoachingPaused } from "./coaching-settings";
import type { CoachingSettings } from "../domain/types";
import { startOfDayInTimezone, endOfDayInTimezone } from "../date/timezone";

/** Gathers real inputs and runs determineBehavioralState — the one place that turns raw activity into "what's actually going on right now." */
export async function getCurrentBehavioralState(userId: string, now: Date = new Date()): Promise<BehavioralState> {
  const coachingSettings = await getCoachingSettings(userId);

  if (!isSupabaseConfigured()) {
    return getCurrentBehavioralStateDemo(now, coachingSettings);
  }

  const timezone = coachingSettings.timezone;
  const todayStart = startOfDayInTimezone(now, timezone).toISOString();
  const todayEnd = endOfDayInTimezone(now, timezone).toISOString();

  const supabase = createAdminSupabaseClient();
  const [{ data: profileRow }, { data: goalRow }, { data: activeBlockRow }, { data: connectionRow }, { data: todaysCalls }, { data: recentEndedBlocks }] =
    await Promise.all([
      supabase.from("profiles").select("workdays, calling_hours_start, calling_hours_end").eq("user_id", userId).maybeSingle(),
      supabase.from("goals").select("daily_call_target").eq("user_id", userId).maybeSingle(),
      supabase.from("work_blocks").select("status, call_target, calls_completed, last_activity_at").eq("user_id", userId).eq("status", "active").maybeSingle(),
      supabase.from("highlevel_connections").select("connected, last_verified_at, error").eq("user_id", userId).maybeSingle(),
      supabase
        .from("call_events")
        .select("start_time")
        .eq("user_id", userId)
        .gte("start_time", todayStart)
        .lte("start_time", todayEnd)
        .order("start_time", { ascending: true }),
      supabase
        .from("work_blocks")
        .select("status, call_target, calls_completed, updated_at")
        .eq("user_id", userId)
        .neq("status", "active")
        .gte("created_at", todayStart)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

  const callsToday = todaysCalls?.length ?? 0;
  const firstCallAt = todaysCalls && todaysCalls.length > 0 ? new Date(todaysCalls[0].start_time) : null;
  const lastCallOfDayAt = todaysCalls && todaysCalls.length > 0 ? new Date(todaysCalls[todaysCalls.length - 1].start_time) : null;

  const completedBlocks: BehavioralStateCompletedBlock[] = (recentEndedBlocks ?? []).map((b) => ({
    status: b.status,
    callTarget: b.call_target,
    callsCompleted: b.calls_completed,
  }));

  return determineBehavioralState({
    now,
    timezone,
    schedule: {
      workdays: profileRow?.workdays ?? [],
      callingHoursStart: profileRow?.calling_hours_start ?? "09:00",
      callingHoursEnd: profileRow?.calling_hours_end ?? "17:00",
      desiredFirstCallTime: coachingSettings.desiredFirstCallTime,
    },
    callsToday,
    activeBlock: activeBlockRow
      ? { status: activeBlockRow.status, callTarget: activeBlockRow.call_target, callsCompleted: activeBlockRow.calls_completed }
      : null,
    lastCallAt: activeBlockRow?.last_activity_at ? new Date(activeBlockRow.last_activity_at) : lastCallOfDayAt,
    firstCallAt,
    dailyTarget: goalRow?.daily_call_target ?? 0,
    completedBlocks,
    coachingPaused: isCoachingPaused(coachingSettings, now),
    syncStatus: {
      connected: connectionRow?.connected ?? false,
      lastSyncedAt: connectionRow?.last_verified_at ? new Date(connectionRow.last_verified_at) : null,
      error: connectionRow?.error ?? null,
    },
    inactivityThresholdMinutes: coachingSettings.inactivityThresholdMinutes,
    behindPaceTolerancePct: coachingSettings.behindPaceTolerancePct,
  });
}

function getCurrentBehavioralStateDemo(now: Date, coachingSettings: CoachingSettings): BehavioralState {
  const state = getDemoState();
  const timezone = coachingSettings.timezone;
  const todayStart = startOfDayInTimezone(now, timezone).getTime();
  const todayEnd = endOfDayInTimezone(now, timezone).getTime();

  const todaysCalls = state.callEvents
    .filter((c) => {
      const t = new Date(c.startTime).getTime();
      return t >= todayStart && t <= todayEnd;
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const activeBlock = state.workBlocks.find((b) => b.status === "active") ?? null;
  const completedBlocks: BehavioralStateCompletedBlock[] = state.workBlocks
    .filter((b) => b.status !== "active" && new Date(b.createdAt).getTime() >= todayStart)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((b) => ({ status: b.status, callTarget: b.callTarget, callsCompleted: b.callsCompleted }));

  return determineBehavioralState({
    now,
    timezone,
    schedule: {
      workdays: state.profile.workdays,
      callingHoursStart: state.profile.callingHoursStart,
      callingHoursEnd: state.profile.callingHoursEnd,
      desiredFirstCallTime: coachingSettings.desiredFirstCallTime,
    },
    callsToday: todaysCalls.length,
    activeBlock: activeBlock ? { status: activeBlock.status, callTarget: activeBlock.callTarget, callsCompleted: activeBlock.callsCompleted } : null,
    lastCallAt: activeBlock?.lastActivityAt
      ? new Date(activeBlock.lastActivityAt)
      : todaysCalls.length > 0
        ? new Date(todaysCalls[todaysCalls.length - 1].startTime)
        : null,
    firstCallAt: todaysCalls.length > 0 ? new Date(todaysCalls[0].startTime) : null,
    dailyTarget: state.goal.dailyCallTarget,
    completedBlocks,
    coachingPaused: isCoachingPaused(coachingSettings, now),
    syncStatus: { connected: false, lastSyncedAt: null, error: null },
    inactivityThresholdMinutes: coachingSettings.inactivityThresholdMinutes,
    behindPaceTolerancePct: coachingSettings.behindPaceTolerancePct,
  });
}
