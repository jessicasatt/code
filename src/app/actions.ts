"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { endCallBlock, logQuickCallResult, startCallBlock } from "@/lib/data/call-blocks";
import { completeOnboarding, OnboardingInputSchema, type OnboardingInput } from "@/lib/data/onboarding";
import { updateGoal, updateProfile, type GoalPatch, type ProfilePatch } from "@/lib/data/settings";
import { BEHAVIORAL_CHECKIN_REASONS, type AnsweredStatus, type BehavioralCheckinReason } from "@/lib/domain/types";
import { recordDemoBehavioralCheckin, resetDemoState } from "@/lib/demo/store";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DELETABLE_TABLES = [
  "notification_deliveries",
  "behavioral_checkins",
  "call_events",
  "work_blocks",
  "follow_ups",
  "appointments",
  "opportunities",
  "contacts",
  "highlevel_connections",
  "goals",
  "profiles",
] as const;

export async function completeOnboardingAction(input: OnboardingInput) {
  const user = await requireUser();
  const parsed = OnboardingInputSchema.parse(input);
  await completeOnboarding(user.id, parsed);
  revalidatePath("/today");
  // Deliberately does not call redirect() here: this action is invoked
  // directly from a client component wrapped in try/catch (to surface
  // validation errors in the form), and redirect()'s internal throw would
  // be swallowed by that catch. The client navigates on success instead.
}

export async function startCallBlockAction(input: { durationMinutes: number; callTarget: number }) {
  const user = await requireUser();
  await startCallBlock(user.id, input);
  revalidatePath("/today");
}

export async function endCallBlockAction(blockId: string) {
  const user = await requireUser();
  await endCallBlock(user.id, blockId);
  revalidatePath("/today");
}

export async function logQuickResultAction(input: { answeredStatus: AnsweredStatus; meaningfulConversation: boolean }) {
  const user = await requireUser();
  await logQuickCallResult(user.id, input);
  revalidatePath("/today");
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
  revalidatePath("/today");
}

export async function updateGoalAction(patch: GoalPatch) {
  const user = await requireUser();
  await updateGoal(user.id, patch);
  revalidatePath("/settings");
  revalidatePath("/today");
}

export async function updateProfileAction(patch: ProfilePatch) {
  const user = await requireUser();
  await updateProfile(user.id, patch);
  revalidatePath("/settings");
  revalidatePath("/today");
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
