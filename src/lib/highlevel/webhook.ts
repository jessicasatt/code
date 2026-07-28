import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * We have not yet observed a real HighLevel webhook payload (per SPEC.md
 * this must never be fabricated). This module only does what's safe to do
 * generically: accept anything, compute a stable identity for
 * deduplication, and make a best-effort guess at the event type from
 * common field names. Detailed per-field normalization (calls,
 * opportunities, appointments) is implemented after inspecting a real
 * payload with the account owner.
 */
export const RawWebhookEnvelopeSchema = z.looseObject({});
export type RawWebhookEnvelope = z.infer<typeof RawWebhookEnvelopeSchema>;

const EVENT_TYPE_FIELD_CANDIDATES = ["type", "event", "eventType", "event_type"] as const;
const EXTERNAL_ID_FIELD_CANDIDATES = ["id", "eventId", "event_id", "messageId", "webhookId"] as const;

export function detectEventType(payload: RawWebhookEnvelope): string {
  for (const field of EVENT_TYPE_FIELD_CANDIDATES) {
    const value = (payload as Record<string, unknown>)[field];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "unknown";
}

export function extractExternalEventId(payload: RawWebhookEnvelope): string | null {
  for (const field of EXTERNAL_ID_FIELD_CANDIDATES) {
    const value = (payload as Record<string, unknown>)[field];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

export function computeContentHash(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

/**
 * Stable dedupe key: prefer the provider's own event id (matches the DB
 * unique constraint on external_event_id); fall back to a content hash so
 * an id-less payload still gets deduplicated against an exact byte-for-byte
 * redelivery rather than being silently dropped as "no id, keep it".
 */
export function computeDedupeKey(input: { externalEventId: string | null; rawBody: string }): string {
  if (input.externalEventId) return `id:${input.externalEventId}`;
  return `hash:${computeContentHash(input.rawBody)}`;
}

export function isDuplicateEvent(dedupeKey: string, seenKeys: ReadonlySet<string>): boolean {
  return seenKeys.has(dedupeKey);
}

export const WEBHOOK_RATE_LIMIT_WINDOW_SECONDS = 10;
export const WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 60;

/** Pure decision function; the route handler supplies the actual recent-request count from storage. */
export function isRateLimited(recentRequestCount: number, max: number = WEBHOOK_RATE_LIMIT_MAX_REQUESTS): boolean {
  return recentRequestCount >= max;
}
