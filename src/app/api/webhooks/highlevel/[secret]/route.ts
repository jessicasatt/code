import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { getSingleAppUserId } from "@/lib/data/single-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  computeDedupeKey,
  detectEventType,
  extractExternalEventId,
  isRateLimited,
  WEBHOOK_RATE_LIMIT_WINDOW_SECONDS,
} from "@/lib/highlevel/webhook";

/**
 * Generic HighLevel webhook receiver (Milestone 2, step 1 per
 * HIGHLEVEL_INTEGRATION.md): accepts any payload, stores it raw before any
 * parsing, deduplicates, and responds fast. No per-field normalization
 * happens here yet — that's written only after inspecting one real
 * payload with the account owner.
 *
 * Auth model: the URL path segment is a shared secret
 * (HIGHLEVEL_WEBHOOK_SHARED_SECRET). HighLevel does not confirm a signed-
 * webhook mechanism for Private Integration / workflow-driven webhooks
 * (see HIGHLEVEL_INTEGRATION.md), so the secret URL is the primary
 * safeguard, backed by rate limiting and fully idempotent handling.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ secret: string }> }) {
  const { secret } = await context.params;
  const env = getServerEnv();

  if (!env.HIGHLEVEL_WEBHOOK_SHARED_SECRET || secret !== env.HIGHLEVEL_WEBHOOK_SHARED_SECRET) {
    // Same response whether the secret is simply unconfigured or wrong —
    // never confirm to a prober which case it is.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rawBody = await request.text();

  let userId: string;
  try {
    userId = await getSingleAppUserId();
  } catch (error) {
    console.error("Webhook receiver: could not resolve app owner", error);
    // Still 200: HighLevel should not retry-storm us over our own setup gap.
    return NextResponse.json({ ok: true, stored: false }, { status: 200 });
  }

  const supabase = createAdminSupabaseClient();

  const windowStart = new Date(Date.now() - WEBHOOK_RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("raw_webhook_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "highlevel")
    .gte("received_at", windowStart);

  if (isRateLimited(recentCount ?? 0)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let payload: unknown = {};
  try {
    payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    payload = { _unparsedBody: rawBody };
  }

  const externalEventId = extractExternalEventId(payload as Record<string, unknown>);
  const dedupeKey = computeDedupeKey({ externalEventId, rawBody });
  const eventType = detectEventType(payload as Record<string, unknown>);

  const { error: insertError } = await supabase.from("raw_webhook_events").insert({
    user_id: userId,
    source: "highlevel",
    event_type: eventType,
    external_event_id: externalEventId,
    dedupe_key: dedupeKey,
    raw_payload: payload,
    processing_status: "pending",
  });

  if (insertError) {
    // Unique violation on (user_id, dedupe_key) means this is a HighLevel
    // retry of an event we already have — that's success, not an error.
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }
    console.error("Webhook receiver: failed to store raw event", insertError);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
