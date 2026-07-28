"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { endCallBlock, logQuickCallResult, startCallBlock } from "@/lib/data/call-blocks";
import { completeOnboarding, OnboardingInputSchema, type OnboardingInput } from "@/lib/data/onboarding";
import { updateGoal, updateProfile, type GoalPatch, type ProfilePatch } from "@/lib/data/settings";
import { setNotificationPreference } from "@/lib/data/notification-preferences";
import { pauseCoaching, setVacationMode, updateCoachingSettings, type CoachingSettingsPatch } from "@/lib/data/coaching-settings";
import { BEHAVIORAL_CHECKIN_REASONS, type AnsweredStatus, type BehavioralCheckinReason } from "@/lib/domain/types";
import type { NotificationCategory } from "@/lib/domain/notifications";
import { recordDemoBehavioralCheckin, resetDemoState } from "@/lib/demo/store";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DELETABLE_TABLES = [
  "notification_deliveries",
  "notification_preferences",
  "push_subscriptions",
  "behavioral_checkins",
  "call_events",
  "work_blocks",
  "follow_ups",
  "appointments",
  "opportunities",
  "contacts",
  "highlevel_connections",
  "coaching_settings",
  "goals",
  "profiles",
] as const;

export async function completeOnboardingAction(input: OnboardingInput) {
  const user = await requireUser();
  const parsed = OnboardingInputSchema.parse(input);
  await completeOnboarding(user.id, parsed);
  revalidatePath("/execute");
  // Deliberately does not call redirect() here: this action is invoked
  // directly from a client component wrapped in try/catch (to surface
  // validation errors in the form), and redirect()'s internal throw would
  // be swallowed by that catch. The client navigates on success instead.
}

export async function startCallBlockAction(input: { durationMinutes: number; callTarget: number }) {
  const user = await requireUser();
  await startCallBlock(user.id, input);
  revalidatePath("/execute");
}

export async function endCallBlockAction(blockId: string) {
  const user = await requireUser();
  await endCallBlock(user.id, blockId);
  revalidatePath("/execute");
}

export async function logQuickResultAction(input: { answeredStatus: AnsweredStatus; meaningfulConversation: boolean }) {
  const user = await requireUser();
  await logQuickCallResult(user.id, input);
  revalidatePath("/execute");
}

export async function recordCheckinAction(input: { reason: BehavioralCheckinReason; note: string | null; trigger: string }) {
  const user = await requireUser();
  if (!BEHAVIORAL_CHECKIN_REASONS.includes(input.reason)) {
    throw new Error("Invalid check-in reason");
  }

  if (!isSupabaseConfigured()) {
    recordDemoBehavioralCheckin(input);
  } else {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("behavioral_checkins").insert({
      user_id: user.id,
      trigger: input.trigger,
      reason: input.reason,
      note: input.note,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/execute");
}

export async function updateGoalAction(patch: GoalPatch) {
  const user = await requireUser();
  await updateGoal(user.id, patch);
  revalidatePath("/settings");
  revalidatePath("/execute");
}

export async function updateProfileAction(patch: ProfilePatch) {
  const user = await requireUser();
  await updateProfile(user.id, patch);
  revalidatePath("/settings");
  revalidatePath("/execute");
}

export async function updateNotificationPreferenceAction(category: NotificationCategory, enabled: boolean) {
  const user = await requireUser();
  await setNotificationPreference(user.id, category, enabled);
  revalidatePath("/settings");
}

export async function updateCoachingSettingsAction(patch: CoachingSettingsPatch) {
  const user = await requireUser();
  await updateCoachingSettings(user.id, patch);
  revalidatePath("/settings/coaching");
}

/** Quick pause options: 30 min / 1 hour / until tomorrow morning. Pass null to clear an active pause. */
export async function pauseCoachingAction(minutesFromNow: number | "tomorrow" | null) {
  const user = await requireUser();
  let until: Date | null = null;
  if (minutesFromNow === "tomorrow") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 0, 0, 0);
    until = tomorrow;
  } else if (typeof minutesFromNow === "number") {
    until = new Date(Date.now() + minutesFromNow * 60_000);
  }
  await pauseCoaching(user.id, until);
  revalidatePath("/settings/coaching");
  revalidatePath("/execute");
}

export async function setVacationModeAction(enabled: boolean) {
  const user = await requireUser();
  await setVacationMode(user.id, enabled);
  revalidatePath("/settings/coaching");
  revalidatePath("/execute");
}

/** "Delete my data" (SPEC.md Settings). Removes every app-owned row for this user, then signs out. */
export async function deleteMyDataAction() {
  const user = await requireUser();

  if (!isSupabaseConfigured()) {
    resetDemoState();
  } else {
    const supabase = await createServerSupabaseClient();
    for (const table of DELETABLE_TABLES) {
      await supabase.from(table).delete().eq("user_id", user.id);
    }
    await supabase.auth.signOut();
  }

  redirect("/sign-in");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/sign-in");
}
