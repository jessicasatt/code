import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv, isHighLevelConfigured } from "@/lib/env";
import { getHighLevelProvider } from "@/lib/highlevel";

/**
 * Scheduled reconciliation (SPEC.md: "Build reconciliation jobs so missed
 * webhooks can eventually be corrected from the HighLevel API"). Also
 * doubles as the primary ingestion path for now, since no real-time
 * webhook has been wired into GoHighLevel yet. Runs on Vercel Cron — see
 * vercel.json. Protected by CRON_SECRET so it can't be triggered by
 * anyone who finds the URL.
 */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isHighLevelConfigured()) {
    return NextResponse.json({ ok: true, skipped: "HighLevel not connected" });
  }

  const provider = getHighLevelProvider();
  const to = new Date();
  // Overlapping lookback window (not just "since last run") so a single
  // missed/failed run can't permanently lose activity.
  const from = new Date(to.getTime() - 36 * 60 * 60 * 1000);

  const result = await provider.reconcileActivity({ from, to });

  return NextResponse.json(result);
}
