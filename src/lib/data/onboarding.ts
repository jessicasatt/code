import { isSupabaseConfigured } from "../env";
import { getDemoState } from "../demo/store";
import { dollarsToCents } from "../domain/money";
import { createServerSupabaseClient } from "../supabase/server";
import type { OnboardingInput } from "../domain/onboarding-input";

export { WEEKDAYS, OnboardingInputSchema, type OnboardingInput } from "../domain/onboarding-input";

export async function isOnboardingComplete(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return getDemoState().onboarded;
  }
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("profiles").select("onboarding_completed_at").eq("user_id", userId).maybeSingle();
  return Boolean(data?.onboarding_completed_at);
}

export async function completeOnboarding(userId: string, input: OnboardingInput): Promise<void> {
  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const state = getDemoState();
    state.profile = {
      ...state.profile,
      name: input.name,
      morningBriefTime: input.morningBriefTime,
      endOfDaySummaryTime: input.endOfDaySummaryTime,
      callingHoursStart: input.callingHoursStart,
      callingHoursEnd: input.callingHoursEnd,
      workdays: input.workdays,
      onboardingCompletedAt: now,
      updatedAt: now,
    };
    state.goal = {
      ...state.goal,
      monthlyRevenueGoalCents: dollarsToCents(input.monthlyRevenueGoalDollars),
      currentMrrCents: dollarsToCents(input.currentMrrDollars),
      averageClientValueCents: dollarsToCents(input.averageClientValueDollars),
      dailyCallTarget: input.dailyCallTarget,
      weeklyCallTarget: input.weeklyCallTarget,
      updatedAt: now,
    };
    state.onboarded = true;
    return;
  }

  const supabase = await createServerSupabaseClient();
  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: userId,
    name: input.name,
    morning_brief_time: input.morningBriefTime,
    end_of_day_summary_time: input.endOfDaySummaryTime,
    calling_hours_start: input.callingHoursStart,
    calling_hours_end: input.callingHoursEnd,
    workdays: input.workdays,
    onboarding_completed_at: now,
  });
  if (profileError) throw new Error(profileError.message);

  const { error: goalError } = await supabase.from("goals").upsert({
    user_id: userId,
    monthly_revenue_goal_cents: dollarsToCents(input.monthlyRevenueGoalDollars),
    current_mrr_cents: dollarsToCents(input.currentMrrDollars),
    average_client_value_cents: dollarsToCents(input.averageClientValueDollars),
    daily_call_target: input.dailyCallTarget,
    weekly_call_target: input.weeklyCallTarget,
  });
  if (goalError) throw new Error(goalError.message);

  const { error: connectionError } = await supabase.from("highlevel_connections").upsert({
    user_id: userId,
    mode: "disconnected",
    connected: false,
  });
  if (connectionError) throw new Error(connectionError.message);
}
