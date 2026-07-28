import type { AnsweredStatus, CallEvent, Contact } from "../domain/types";

/**
 * Maps HighLevel API responses to our domain types. Field names here were
 * confirmed against real responses from the connected account's own API
 * (GET /contacts/, GET /conversations/search, GET
 * /conversations/{id}/messages) — not guessed from docs, per SPEC.md's
 * rule against fabricating the payload shape.
 */

/**
 * HighLevel is inconsistent about timestamp format across endpoints:
 * GET /conversations/search returns dateAdded/dateUpdated as raw
 * Unix-epoch-milliseconds numbers, while GET /conversations/{id}/messages
 * and GET /contacts/ return ISO 8601 strings. Postgres rejects a raw epoch
 * number passed as a timestamptz string outright ("out of range"), so
 * every timestamp from this API is normalized through here before use.
 */
export function coerceToIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") {
    // Some responses carry the epoch as a numeric string too.
    if (/^\d+$/.test(value)) return new Date(Number(value)).toISOString();
    return value;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapHighLevelContact(userId: string, raw: any): Contact {
  const name = [raw.firstName, raw.lastName].filter(Boolean).join(" ").trim();
  return {
    id: raw.id,
    userId,
    highlevelContactId: raw.id,
    businessName: raw.companyName ?? null,
    contactName: name || raw.contactName || null,
    niche: null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    timezone: raw.timezone ?? null,
    lastActivityAt: coerceToIso(raw.dateUpdated),
  };
}

function mapAnsweredStatus(status: string | undefined | null): AnsweredStatus {
  if (status === "completed") return "answered";
  if (status === "voicemail") return "voicemail";
  if (status === "no-answer" || status === "busy" || status === "failed" || status === "canceled") return "no_answer";
  return "unknown";
}

/** `raw` is a HighLevel conversation message with messageType === "TYPE_CALL". */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapHighLevelCallMessage(userId: string, contactId: string | null, raw: any): CallEvent {
  const callMeta = raw.meta?.call ?? {};
  const durationSeconds = typeof callMeta.duration === "number" ? callMeta.duration : null;
  const providerStatus: string | null = callMeta.status ?? raw.status ?? null;
  const answeredStatus = mapAnsweredStatus(providerStatus);
  const startTime = coerceToIso(raw.dateAdded) ?? new Date().toISOString();

  return {
    id: raw.id,
    userId,
    // altId is HighLevel's underlying telephony provider call id (Twilio
    // CallSid in observed data); prefer it since it's stable across
    // HighLevel's own message id churn, falling back to the message id.
    externalId: raw.altId ?? raw.id,
    contactId,
    workBlockId: null,
    direction: raw.direction === "outbound" ? "outbound" : "inbound",
    startTime,
    endTime: coerceToIso(raw.dateUpdated),
    durationSeconds,
    providerStatus,
    answeredStatus,
    voicemailStatus: answeredStatus === "voicemail",
    disposition: null,
    // SPEC.md: never infer "meaningful conversation" from duration alone.
    // Not set by reconciliation — only by explicit one-tap classification.
    meaningfulConversation: null,
    appointmentResult: null,
    sourcePayloadId: null,
    createdAt: startTime,
  };
}
