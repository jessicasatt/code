# HighLevel integration

## Status today (Milestone 1 complete, Milestone 2 not started)

- ✅ Provider interface (`src/lib/highlevel/provider.ts`) — the contract
  every other part of the app depends on.
- ✅ `DemoHighLevelProvider` — fixture data, used automatically until
  HighLevel is connected.
- ✅ `PrivateIntegrationHighLevelProvider` — verifies a Private Integration
  Token + Location ID against `GET /locations/{locationId}` in
  `refreshConnection()`. This is safe to call today.
- ✅ Dedup/redaction primitives (`src/lib/highlevel/webhook.ts`,
  `redact.ts`), unit-tested.
- ❌ Webhook receiver route — not built yet.
- ❌ Call/contact/opportunity/appointment normalization — not built yet.
- ❌ Webhook Inspector screen — not built yet.
- ❌ Reconciliation job — not built yet.

**Why the gap:** SPEC.md is explicit — "Do not fabricate a HighLevel
webhook schema" and "Do not assume the exact HighLevel call payload." I
have not seen a real payload from this account, so I have not written
normalization logic that would necessarily be wrong. The receiver-first
process below is exactly what happens once Supabase + HighLevel
credentials are connected (Milestone 2).

## Connection modes

**Development mode (build this first):** a Private Integration Token +
Location ID, set as server-only environment variables
(`HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN`, `HIGHLEVEL_LOCATION_ID`). Never sent
to the browser. See `SETUP.md` Phase 2 for how to create one.

**Future mode:** OAuth. The provider interface exists specifically so this
can be added as a second implementation later without touching any caller.

## What happens once credentials are connected (Milestone 2 plan)

1. Build the generic webhook receiver: accepts any payload, stores it raw
   in `raw_webhook_events` before any parsing, computes a dedupe key
   (`external_event_id` when present, else a content hash — already
   implemented and tested in `webhook.ts`), and responds quickly.
2. Deploy it.
3. Give you the exact webhook URL to paste into HighLevel's webhook
   settings.
4. Give you one exact action to trigger a single test outbound call.
5. Ask you to complete that call.
6. Inspect the received payload together (via the Webhook Inspector screen,
   with phone numbers/emails/tokens/recording URLs redacted using
   `redact.ts`).
7. Write the real normalizer based on the observed fields.
8. Save an anonymized fixture of that payload for automated tests, so the
   normalizer has a regression test from day one.

## Webhook authenticity

Not yet applicable — no receiver exists yet. When built, this document will
state explicitly what signature mechanism (if any) HighLevel supplies for
webhooks on this specific integration type, and which parts of the request
are verified vs. not. If no verifiable signature is available for this
integration type, the receiver will rely on the URL itself being a secret,
rate limiting, and idempotent, side-effect-free handling of any payload
(valid or not).

## Rate limiting and reconciliation

The webhook receiver will be rate-limited (public endpoint). Because
webhooks can be missed, a reconciliation job (`reconcileActivity` in the
provider interface) will periodically pull recent activity directly from
the HighLevel API and fill in anything the webhook stream missed. This is
scaffolded in the interface today; the implementation lands with the
receiver in Milestone 2, once real API responses have been inspected.
