import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { syncActiveWorkBlock } from "@/lib/highlevel/sync";
import { runInterventionEngine } from "@/lib/notifications/intervention-engine";

/**
 * Client-driven, on-demand sync (not cron-gated — safe to call every
 * 20-30 seconds). This is the real-time ingestion path described in
 * DATA_FLOW_AUDIT.md: ordinary authenticated route, called by the Execute
 * screen while it's open, rather than a scheduled job. Also the trigger
 * point for the intervention engine's block-adjacent checks (currently
 * just inactive_mid_block), since this is the one place that always has a
 * just-refreshed view of the active block's activity.
 */
export async function POST() {
  const user = await requireUser();
  const result = await syncActiveWorkBlock(user.id);

  if (result.synced) {
    await runInterventionEngine(user.id);
  }

  return NextResponse.json(result);
}
