import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { syncActiveWorkBlock } from "@/lib/highlevel/sync";
import { isInactiveDuringActiveBlock, INACTIVITY_THRESHOLD_MINUTES } from "@/lib/domain/notifications";
import { notifyInactivityIfEligible } from "@/lib/notifications/triggers";
import { getCoachingSettings, isCoachingPaused } from "@/lib/data/coaching-settings";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Client-driven, on-demand sync (not cron-gated — safe to call every
 * 20-30 seconds). This is the real-time ingestion path described in
 * DATA_FLOW_AUDIT.md: ordinary authenticated route, called by the Execute
 * screen while it's open, rather than a scheduled job. Also the trigger
 * point for the inactivity nudge, since it's the one place that always has
 * a just-refreshed view of the active block's last_activity_at.
 */
export async function POST() {
  const user = await requireUser();
  const result = await syncActiveWorkBlock(user.id);

  if (result.synced && result.activeBlockId && isSupabaseConfigured()) {
    const coachingSettings = await getCoachingSettings(user.id);

    if (!isCoachingPaused(coachingSettings)) {
      const supabase = await createServerSupabaseClient();
      const { data: block } = await supabase
        .from("work_blocks")
        .select("status, last_activity_at")
        .eq("id", result.activeBlockId)
        .maybeSingle();

      if (block) {
        const inactive = isInactiveDuringActiveBlock({
          blockStatus: block.status,
          lastActivityAt: block.last_activity_at ? new Date(block.last_activity_at) : null,
          now: new Date(),
          thresholdMinutes: coachingSettings.inactivityThresholdMinutes ?? INACTIVITY_THRESHOLD_MINUTES,
        });
        if (inactive) {
          await notifyInactivityIfEligible(user.id, new Date(), coachingSettings.notificationCooldownMinutes);
        }
      }
    }
  }

  return NextResponse.json(result);
}
