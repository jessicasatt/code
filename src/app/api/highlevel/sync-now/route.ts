import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { syncActiveWorkBlock } from "@/lib/highlevel/sync";

/**
 * Client-driven, on-demand sync (not cron-gated — safe to call every
 * 20-30 seconds). This is the real-time ingestion path described in
 * DATA_FLOW_AUDIT.md: ordinary authenticated route, called by the Execute
 * screen while it's open, rather than a scheduled job.
 */
export async function POST() {
  const user = await requireUser();
  const result = await syncActiveWorkBlock(user.id);
  return NextResponse.json(result);
}
