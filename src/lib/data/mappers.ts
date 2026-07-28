import type { CoachingSettings, Goal, Profile, WorkBlock } from "../domain/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapProfileRow(row: any): Profile {
  return {
    userId: row.user_id,
    name: row.name,
    morningBriefTime: row.morning_brief_time,
    endOfDaySummaryTime: row.end_of_day_summary_time,
    callingHoursStart: row.calling_hours_start,
    callingHoursEnd: row.calling_hours_end,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    workdays: row.workdays,
    onboardingCompletedAt: row.onboarding_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapGoalRow(row: any): Goal {
  return {
    userId: row.user_id,
    monthlyRevenueGoalCents: row.monthly_revenue_goal_cents,
    currentMrrCents: row.current_mrr_cents,
    averageClientValueCents: row.average_client_value_cents,
    dailyCallTarget: row.daily_call_target,
    weeklyCallTarget: row.weekly_call_target,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCoachingSettingsRow(row: any): CoachingSettings {
  return {
    userId: row.user_id,
    timezone: row.timezone,
    desiredFirstCallTime: row.desired_first_call_time,
    defaultBlockSize: row.default_block_size,
    inactivityThresholdMinutes: row.inactivity_threshold_minutes,
    behindPaceTolerancePct: row.behind_pace_tolerance_pct,
    notificationCooldownMinutes: row.notification_cooldown_minutes,
    maxProactiveNotificationsPerDay: row.max_proactive_notifications_per_day,
    coachingIntensity: row.coaching_intensity,
    coachingPausedUntil: row.coaching_paused_until,
    vacationMode: row.vacation_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapWorkBlockRow(row: any): WorkBlock {
  return {
    id: row.id,
    userId: row.user_id,
    plannedStart: row.planned_start,
    plannedEnd: row.planned_end,
    actualStart: row.actual_start,
    actualEnd: row.actual_end,
    callTarget: row.call_target,
    callsCompleted: row.calls_completed,
    status: row.status,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
