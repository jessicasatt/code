import "server-only";
import { createAdminSupabaseClient } from "../supabase/admin";
import { getHighLevelProvider } from "./index";
import { isHighLevelConfigured } from "../env";

export interface SyncResult {
  ok: boolean;
  synced: boolean;
  activeBlockId: string | null;
  callsCompleted: number | null;
  lastActivityAt: string | null;
  error: string | null;
}

/**
 * The real-time-ish ingestion path (see DATA_FLOW_AUDIT.md): scoped to
 * "since the active block started" rather than a broad daily sweep, so
 * it's cheap enough to call every 20-30 seconds from the client while the
 * Execute screen is open. Pulls recent HighLevel call activity, upserts
 * it, and — unlike the daily reconciliation cron — links newly-found
 * calls to the currently active work block and recomputes its progress.
 * Falls back to no-op when there's no active block (nothing to sync in
 * real time) or HighLevel isn't connected.
 */
export async function syncActiveWorkBlock(userId: string): Promise<SyncResult> {
  if (!isHighLevelConfigured()) {
    return { ok: true, synced: false, activeBlockId: null, callsCompleted: null, lastActivityAt: null, error: null };
  }

  const supabase = createAdminSupabaseClient();
  const { data: block } = await supabase
    .from("work_blocks")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!block) {
    return { ok: true, synced: false, activeBlockId: null, callsCompleted: null, lastActivityAt: null, error: null };
  }

  const provider = getHighLevelProvider();
  const from = new Date(block.actual_start ?? block.planned_start);
  const to = new Date();

  let syncError: string | null = null;
  try {
    const result = await provider.reconcileActivity({ from, to });
    if (result.errors.length > 0) syncError = result.errors[0];
  } catch (error) {
    syncError = error instanceof Error ? error.message : String(error);
  }

  await supabase
    .from("highlevel_connections")
    .update({ connected: !syncError, last_verified_at: to.toISOString(), error: syncError })
    .eq("user_id", userId);

  // Link any of this block's calls that reconciliation just wrote (or
  // wrote previously but never got linked) and recompute progress from
  // the actual linked rows, rather than incrementing a counter — this
  // stays correct even if a sync is retried or runs out of order.
  await supabase
    .from("call_events")
    .update({ work_block_id: block.id })
    .eq("user_id", userId)
    .is("work_block_id", null)
    .eq("direction", "outbound")
    .gte("start_time", from.toISOString())
    .lte("start_time", to.toISOString());

  const { data: linkedCalls } = await supabase
    .from("call_events")
    .select("start_time")
    .eq("work_block_id", block.id)
    .order("start_time", { ascending: false });

  const callsCompleted = linkedCalls?.length ?? block.calls_completed;
  const lastActivityAt = linkedCalls && linkedCalls.length > 0 ? linkedCalls[0].start_time : block.last_activity_at;

  if (callsCompleted !== block.calls_completed || lastActivityAt !== block.last_activity_at) {
    await supabase
      .from("work_blocks")
      .update({ calls_completed: callsCompleted, last_activity_at: lastActivityAt })
      .eq("id", block.id);
  }

  return {
    ok: !syncError,
    synced: true,
    activeBlockId: block.id,
    callsCompleted,
    lastActivityAt,
    error: syncError,
  };
}
