import "server-only";
import { isSupabaseConfigured } from "../env";
import { createServerSupabaseClient } from "../supabase/server";
import { createAdminSupabaseClient } from "../supabase/admin";
import { resolveCheckinResumption } from "../domain/behavioral-metrics";
import { getDemoState } from "../demo/store";

/**
 * When a new call lands, check whether it resolves an open inactivity
 * check-in (one created within the last hour that hasn't been resolved
 * yet) and record how quickly the user resumed. Called from both the
 * manual "log result" path and the HighLevel on-demand sync path — this is
 * the only place resumed_within_10/30/60_min ever get set.
 */
export async function markPendingCheckinResumed(userId: string, callAt: Date, useAdminClient = false): Promise<void> {
  if (!isSupabaseConfigured()) {
    markPendingDemoCheckinResumed(callAt);
    return;
  }

  const supabase = useAdminClient ? createAdminSupabaseClient() : await createServerSupabaseClient();
  const oneHourAgo = new Date(callAt.getTime() - 60 * 60_000).toISOString();

  const { data: pending } = await supabase
    .from("behavioral_checkins")
    .select("id, created_at")
    .eq("user_id", userId)
    .is("resumed_within_60_min", null)
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pending) return;

  const resumption = resolveCheckinResumption(new Date(pending.created_at), callAt);
  await supabase
    .from("behavioral_checkins")
    .update({
      resumed_within_10_min: resumption.resumedWithin10Min,
      resumed_within_30_min: resumption.resumedWithin30Min,
      resumed_within_60_min: resumption.resumedWithin60Min,
    })
    .eq("id", pending.id);
}

function markPendingDemoCheckinResumed(callAt: Date): void {
  const state = getDemoState();
  const pending = state.behavioralCheckins
    .filter((c) => c.resumedWithin60Min === null && callAt.getTime() - new Date(c.createdAt).getTime() <= 60 * 60_000)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!pending) return;

  const resumption = resolveCheckinResumption(new Date(pending.createdAt), callAt);
  pending.resumedWithin10Min = resumption.resumedWithin10Min;
  pending.resumedWithin30Min = resumption.resumedWithin30Min;
  pending.resumedWithin60Min = resumption.resumedWithin60Min;
}
