import { isSupabaseConfigured } from "../env";
import { getDemoState, updateDemoGoal } from "../demo/store";
import type { Goal, Profile, Weekday } from "../domain/types";
import { createServerSupabaseClient } from "../supabase/server";
import { mapGoalRow, mapProfileRow } from "./mappers";

export interface SettingsSnapshot {
  profile: Profile;
  goal: Goal;
}

export async function getSettings(userId: string): Promise<SettingsSnapshot> {
  if (!isSupabaseConfigured()) {
    const state = getDemoState();
    return { profile: state.profile, goal: state.goal };
  }
  const supabase = await createServerSupabaseClient();
  const [{ data: profileRow }, { data: goalRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("goals").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (!profileRow || !goalRow) throw new Error("Profile or goal not found.");
  return { profile: mapProfileRow(profileRow), goal: mapGoalRow(goalRow) };
}

export interface GoalPatch {
  monthlyRevenueGoalCents?: number;
  currentMrrCents?: number;
  averageClientValueCents?: number;
  dailyCallTarget?: number;
  weeklyCallTarget?: number;
}

export async function updateGoal(userId: string, patch: GoalPatch): Promise<Goal> {
  if (!isSupabaseConfigured()) {
    return updateDemoGoal(patch);
  }
  const supabase = await createServerSupabaseClient();
  const columnPatch: Record<string, number> = {};
  if (patch.monthlyRevenueGoalCents !== undefined) columnPatch.monthly_revenue_goal_cents = patch.monthlyRevenueGoalCents;
  if (patch.currentMrrCents !== undefined) columnPatch.current_mrr_cents = patch.currentMrrCents;
  if (patch.averageClientValueCents !== undefined) columnPatch.average_client_value_cents = patch.averageClientValueCents;
  if (patch.dailyCallTarget !== undefined) columnPatch.daily_call_target = patch.dailyCallTarget;
  if (patch.weeklyCallTarget !== undefined) columnPatch.weekly_call_target = patch.weeklyCallTarget;

  const { data, error } = await supabase.from("goals").update(columnPatch).eq("user_id", userId).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Failed to update goal");
  return mapGoalRow(data);
}

export interface ProfilePatch {
  workdays?: Weekday[];
  callingHoursStart?: string;
  callingHoursEnd?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  morningBriefTime?: string;
  endOfDaySummaryTime?: string;
}

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  if (!isSupabaseConfigured()) {
    const state = getDemoState();
    state.profile = {
      ...state.profile,
      ...(patch.workdays ? { workdays: patch.workdays } : {}),
      ...(patch.callingHoursStart ? { callingHoursStart: patch.callingHoursStart } : {}),
      ...(patch.callingHoursEnd ? { callingHoursEnd: patch.callingHoursEnd } : {}),
      ...(patch.quietHoursStart ? { quietHoursStart: patch.quietHoursStart } : {}),
      ...(patch.quietHoursEnd ? { quietHoursEnd: patch.quietHoursEnd } : {}),
      ...(patch.morningBriefTime ? { morningBriefTime: patch.morningBriefTime } : {}),
      ...(patch.endOfDaySummaryTime ? { endOfDaySummaryTime: patch.endOfDaySummaryTime } : {}),
      updatedAt: new Date().toISOString(),
    };
    return state.profile;
  }
  const supabase = await createServerSupabaseClient();
  const columnPatch: Record<string, unknown> = {};
  if (patch.workdays) columnPatch.workdays = patch.workdays;
  if (patch.callingHoursStart) columnPatch.calling_hours_start = patch.callingHoursStart;
  if (patch.callingHoursEnd) columnPatch.calling_hours_end = patch.callingHoursEnd;
  if (patch.quietHoursStart) columnPatch.quiet_hours_start = patch.quietHoursStart;
  if (patch.quietHoursEnd) columnPatch.quiet_hours_end = patch.quietHoursEnd;
  if (patch.morningBriefTime) columnPatch.morning_brief_time = patch.morningBriefTime;
  if (patch.endOfDaySummaryTime) columnPatch.end_of_day_summary_time = patch.endOfDaySummaryTime;

  const { data, error } = await supabase.from("profiles").update(columnPatch).eq("user_id", userId).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Failed to update profile");
  return mapProfileRow(data);
}
