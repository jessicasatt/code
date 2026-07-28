import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resetDemoState, startDemoWorkBlock } from "@/lib/demo/store";
import { INACTIVITY_THRESHOLD_MINUTES } from "@/lib/domain/notifications";

/**
 * Test-only helper so Playwright can start each scenario from clean demo
 * state. A complete no-op whenever Supabase is configured (i.e. in any
 * real deployment), so this can never touch production data.
 */
export async function POST(request: NextRequest) {
  if (isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available outside demo mode" }, { status: 404 });
  }

  const state = resetDemoState();

  const onboardedParam = request.nextUrl.searchParams.get("onboarded");
  if (onboardedParam === "false") {
    state.onboarded = false;
    state.profile.onboardingCompletedAt = null;
  }

  // Lets e2e tests exercise the inactivity/restart state without waiting
  // out the real threshold: starts an active block whose last activity is
  // already past INACTIVITY_THRESHOLD_MINUTES.
  if (request.nextUrl.searchParams.get("inactiveBlock") === "true") {
    const block = startDemoWorkBlock({
      plannedStart: new Date(),
      plannedEnd: new Date(Date.now() + 30 * 60_000),
      callTarget: 10,
    });
    block.lastActivityAt = new Date(Date.now() - (INACTIVITY_THRESHOLD_MINUTES + 5) * 60_000).toISOString();
  }

  return NextResponse.json({ ok: true });
}
