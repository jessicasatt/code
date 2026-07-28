import { isSupabaseConfigured } from "../env";
import {
  getDemoState,
  pauseDemoCoaching,
  setDemoVacationMode,
  updateDemoCoachingSettings,
  type CoachingSettingsPatch as DemoCoachingSettingsPatch,
} from "../demo/store";
import type { CoachingSettings } from "../domain/types";
import { createServerSupabaseClient } from "../supabase/server";
import { mapCoachingSettingsRow } from "./mappers";

export type CoachingSettingsPatch = DemoCoachingSettingsPatch;

export async function getCoachingSettings(userId: string): Promise<CoachingSettings> {
  if (!isSupabaseConfigured()) {
    return getDemoState().coachingSettings;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("coaching_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);

  if (!data) {
    // Row-per-user is created lazily on first read, mirroring how
    // onboarding creates profiles/goals — coaching settings are optional
    // until the user actually opens that settings section.
    const { data: created, error: insertError } = await supabase
      .from("coaching_settings")
      .insert({ user_id: userId })
      .select("*")
      .single();
    if (insertError || !created) throw new Error(insertError?.message ?? "Failed to create coaching settings");
    return mapCoachingSettingsRow(created);
  }

  return mapCoachingSettingsRow(data);
}

const PATCH_COLUMN_MAP: Record<keyof CoachingSettingsPatch, string> = {
  timezone: "timezone",
  desiredFirstCallTime: "desired_first_call_time",
  defaultBlockSize: "default_block_size",
  inactivityThresholdMinutes: "inactivity_threshold_minutes",
  behindPaceTolerancePct: "behind_pace_tolerance_pct",
  notificationCooldownMinutes: "notification_cooldown_minutes",
  maxProactiveNotificationsPerDay: "max_proactive_notifications_per_day",
  coachingIntensity: "coaching_intensity",
};

export async function updateCoachingSettings(userId: string, patch: CoachingSettingsPatch): Promise<CoachingSettings> {
  if (!isSupabaseConfigured()) {
    return updateDemoCoachingSettings(patch);
  }

  await getCoachingSettings(userId); // ensures a row exists before updating

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columnPatch: Record<string, any> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    columnPatch[PATCH_COLUMN_MAP[key as keyof CoachingSettingsPatch]] = value;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("coaching_settings")
    .update(columnPatch)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to update coaching settings");
  return mapCoachingSettingsRow(data);
}

/** Pause proactive coaching until a specific instant, or clear the pause with `until: null`. Clears vacation mode. */
export async function pauseCoaching(userId: string, until: Date | null): Promise<CoachingSettings> {
  if (!isSupabaseConfigured()) {
    return pauseDemoCoaching(until);
  }

  await getCoachingSettings(userId);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("coaching_settings")
    .update({ coaching_paused_until: until ? until.toISOString() : null, vacation_mode: false })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to pause coaching");
  return mapCoachingSettingsRow(data);
}

/** Vacation mode pauses coaching indefinitely until explicitly turned off. Clears any timed pause. */
export async function setVacationMode(userId: string, enabled: boolean): Promise<CoachingSettings> {
  if (!isSupabaseConfigured()) {
    return setDemoVacationMode(enabled);
  }

  await getCoachingSettings(userId);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("coaching_settings")
    .update({ vacation_mode: enabled, coaching_paused_until: null })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to update vacation mode");
  return mapCoachingSettingsRow(data);
}

/** True when coaching should not proactively intervene right now, for any reason (timed pause or vacation mode). */
export function isCoachingPaused(settings: CoachingSettings, now: Date = new Date()): boolean {
  if (settings.vacationMode) return true;
  if (!settings.coachingPausedUntil) return false;
  return new Date(settings.coachingPausedUntil).getTime() > now.getTime();
}
