# HighLevel integration

## Status today (Milestone 2 in progress)

- ✅ Provider interface (`src/lib/highlevel/provider.ts`) — the contract
  every other part of the app depends on.
- ✅ `DemoHighLevelProvider` — fixture data, used automatically until
  HighLevel is connected.
- ✅ `PrivateIntegrationHighLevelProvider` — connected to a real HighLevel
  account. `refreshConnection()`, `getContacts()`, and `getCalls()` are
  implemented against field names confirmed live against the connected
  account's own API (not guessed from docs — HighLevel's marketplace docs
  return 403 to automated fetches, so this was verified by calling
  `GET /contacts/`, `GET /conversations/search`, and
  `GET /conversations/{id}/messages` directly and reading the real
  response shape). See `src/lib/highlevel/mappers.ts`.
- ✅ Dedup/redaction/rate-limit primitives (`src/lib/highlevel/webhook.ts`,
  `redact.ts`), unit-tested.
- ✅ Generic webhook receiver (`/api/webhooks/highlevel/[secret]`) — raw
  storage, dedup, rate limiting. Live and reachable, but no workflow in
  GoHighLevel has been wired to call it yet (see below).
- ✅ Reconciliation job (`PrivateIntegrationHighLevelProvider.reconcileActivity`)
  pulls recent conversations from the real API and upserts contacts/calls.
  Runs daily via Vercel Cron (`/api/cron/reconcile-highlevel`,
  `vercel.json`) — this is the primary ingestion path today, since no
  real-time webhook is wired up yet. Vercel's Hobby plan caps native cron
  at once/day; each run looks back 36 hours so a daily cadence never loses
  data, just isn't fully real-time.
- ❌ `getOpportunities()` / `getAppointments()` — not implemented; their
  real shapes haven't been inspected yet.
- ❌ Real-time webhook delivery — the receiver exists, but private
  integrations don't get marketplace-app-style webhook subscriptions;
  wiring a GoHighLevel Workflow's "Custom Webhook" action to call it is
  still pending.
- ❌ Webhook Inspector screen — not built yet.

**Why the gap on opportunities/appointments/webhooks:** SPEC.md is
explicit — "Do not fabricate a HighLevel webhook schema" and "Do not
assume the exact HighLevel call payload." Calls and contacts were verified
by calling the connected account's real API directly (see above). Real-time
webhooks, opportunities, and appointments haven't been inspected yet, so
their normalizers aren't written.

## Connection modes

**Development mode (in use today):** a Private Integration Token +
Location ID, set as server-only environment variables
(`HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN`, `HIGHLEVEL_LOCATION_ID`). Never sent
to the browser.

**Future mode:** OAuth. The provider interface exists specifically so this
can be added as a second implementation later without touching any caller.

## How call data actually gets in today

Two paths, both already live:

1. **Reconciliation (primary today).** `/api/cron/reconcile-highlevel` runs
   once a day (Vercel Hobby plan's native cron ceiling), pulls the most
   recently active conversations from `GET /conversations/search`, fetches
   each one's messages, keeps the ones with `messageType: "TYPE_CALL"`, and
   upserts contacts + call events. A 36-hour lookback window means a daily
   cadence never loses data — it's just not real-time.
2. **Webhook receiver (built, not yet wired to a live event source).**
   `/api/webhooks/highlevel/[secret]` accepts, stores, and deduplicates any
   payload. What's still missing is something in GoHighLevel actually
   calling it — Private Integrations don't get marketplace-app-style event
   subscriptions the way OAuth apps do. The likely path is a GoHighLevel
   Workflow with a "Custom Webhook" action, but that hasn't been wired up
   yet. Once it is and a real payload lands, the next step is: inspect it
   (redacted, via the future Webhook Inspector screen), write a normalizer
   for whatever its actual shape turns out to be, and save an anonymized
   fixture for tests. Not fabricated ahead of time.

## Webhook authenticity

HighLevel does document a signed-webhook mechanism (`x-ghl-signature`,
Ed25519, with a legacy `x-wh-signature` RSA-SHA256 fallback) — but that's
confirmed for OAuth **Marketplace App** event subscriptions specifically.
Whether a Private-Integration-driven, Workflow-triggered webhook carries
either header is unconfirmed (HighLevel's docs site returns 403 to
automated fetches, and no real webhook payload has been received yet to
check directly). Until one is inspected, the receiver relies on the URL
itself being a secret (`HIGHLEVEL_WEBHOOK_SHARED_SECRET` as a path segment),
rate limiting, and fully idempotent handling of any payload. If a real
payload turns out to carry a signature header, verification will be added
then.

## Rate limiting and reconciliation

The webhook receiver rate-limits by counting recent `raw_webhook_events`
rows per user in a rolling window (`src/lib/highlevel/webhook.ts`,
`isRateLimited`) and rejects with 429 past the threshold. Reconciliation is
described above — it's live, not just scaffolded.
