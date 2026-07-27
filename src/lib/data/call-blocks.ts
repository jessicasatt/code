import { isSupabaseConfigured } from "../env";
import { endDemoWorkBlock, getActiveDemoWorkBlock, logDemoCallResult, startDemoWorkBlock } from "../demo/store";
import type { AnsweredStatus, WorkBlock } from "../domain/types";
import { createServerSupabaseClient } from "../supabase/server";
import { mapWorkBlockRow } from "./mappers";

export interface StartCallBlockInput {
  durationMinutes: number;
  callTarget: number;
}

export async function startCallBlock(userId: string, input: StartCallBlockInput): Promise<WorkBlock> {
  const now = new Date();
  const plannedEnd = new Date(now.getTime() + input.durationMinutes * 60_000);

  if (!isSupabaseConfigured()) {
    return startDemoWorkBlock({ plannedStart: now, plannedEnd, callTarget: input.callTarget });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("work_blocks")
    .insert({
      user_id: userId,
      planned_start: now.toISOString(),
      planned_end: plannedEnd.toISOString(),
      actual_start: now.toISOString(),
      call_target: input.callTarget,
      calls_completed: 0,
      status: "active",
      last_activity_at: now.toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to start call block");
  return mapWorkBlockRow(data);
}

export async function endCallBlock(userId: string, blockId: string): Promise<WorkBlock | null> {
  if (!isSupabaseConfigured()) {
    return endDemoWorkBlock(blockId, "completed");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("work_blocks")
    .update({ status: "completed", actual_end: new Date().toISOString() })
    .eq("id", blockId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapWorkBlockRow(data);
}

export async function getActiveCallBlock(userId: string): Promise<WorkBlock | null> {
  if (!isSupabaseConfigured()) {
    return getActiveDemoWorkBlock();
  }
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("work_blocks").select("*").eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!data) return null;
  return mapWorkBlockRow(data);
}

/**
 * Manual "log a result" action for demo/local testing, standing in for a
 * real HighLevel call event until webhooks are connected (Milestone 2).
 */
export async function logQuickCallResult(
  userId: string,
  input: { answeredStatus: AnsweredStatus; meaningfulConversation: boolean },
): Promise<void> {
  if (!isSupabaseConfigured()) {
    logDemoCallResult(input);
    return;
  }

  const supabase = await createServerSupabaseClient();
  const activeBlock = await getActiveCallBlock(userId);
  const now = new Date().toISOString();

  const { error } = await supabase.from("call_events").insert({
    user_id: userId,
    external_id: `manual-${Date.now()}`,
    work_block_id: activeBlock?.id ?? null,
    direction: "outbound",
    start_time: now,
    end_time: now,
    duration_seconds: 60,
    provider_status: "completed",
    answered_status: input.answeredStatus,
    voicemail_status: input.answeredStatus === "voicemail",
    meaningful_conversation: input.meaningfulConversation,
    appointment_result: false,
  });
  if (error) throw new Error(error.message);

  if (activeBlock) {
    await supabase
      .from("work_blocks")
      .update({ calls_completed: activeBlock.callsCompleted + 1, last_activity_at: now })
      .eq("id", activeBlock.id)
      .eq("user_id", userId);
  }
}
