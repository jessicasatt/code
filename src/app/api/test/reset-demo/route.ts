import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resetDemoState } from "@/lib/demo/store";

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

  return NextResponse.json({ ok: true });
}
