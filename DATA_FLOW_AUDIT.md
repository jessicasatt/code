# Data Flow Audit — Why activity only appeared once/day

Conducted before any UI changes, per the redesign request. This traces the
exact current path from a real GoHighLevel call to a number changing on
the Today screen, with file/line references, and states the precise root
cause. No fixes in this document — see the "Fix" section at the bottom for
what changes and why, implemented separately.

## 1. How call activity enters the database today

There is exactly **one** path that writes rows into `call_events` from
real HighLevel data: the daily cron.

- `vercel.json` schedules `/api/cron/reconcile-highlevel` at `"0 1 * * *"`
  — 01:00 UTC, which is ~6:00 PM Pacific (PDT). **This is the 6 PM behavior
  you observed — it is exactly one scheduled job, not a coincidence.**
- That route (`src/app/api/cron/reconcile-highlevel/route.ts`) calls
  `PrivateIntegrationHighLevelProvider.reconcileActivity()`
  (`src/lib/highlevel/private-integration-provider.ts:158`), which:
  1. Fetches up to 100 recent conversations from HighLevel's
     `GET /conversations/search`.
  2. For each one active within a 36-hour lookback window, fetches its
     messages and keeps the ones with `messageType: "TYPE_CALL"`.
  3. Upserts a `contacts` row and a `call_events` row per call
     (`onConflict: "user_id,external_id"`, so re-running never duplicates).
- **This is the only code path that has ever inserted a real (non-manual)
  row into `call_events`.** The only other writer is the "Log quick
  result" button (`src/lib/data/call-blocks.ts:73`, `logQuickCallResult`),
  which is a manual stand-in a person taps themselves — not HighLevel data.

## 2. Are HighLevel webhooks receiving events?

**No.** Two independent gaps, either one of which alone would prevent
real-time updates:

- **Nothing in GoHighLevel calls the receiver.** The receiver endpoint
  (`src/app/api/webhooks/highlevel/[secret]/route.ts`) exists, is deployed,
  and works (verified earlier with manual test payloads) — but Private
  Integrations don't get marketplace-app-style webhook subscriptions the
  way OAuth apps do. No GoHighLevel Workflow has been configured with a
  "Custom Webhook" action pointing at it. It has never received a real
  event.
- **Even if it did, nothing processes what it stores.** The receiver
  writes every payload into `raw_webhook_events` with
  `processing_status: "pending"` (line 79) and stops. I checked the entire
  codebase for anything that reads `processing_status` back out —
  **nothing does.** There is no normalizer turning a stored webhook payload
  into a `call_events` row. Raw webhook rows would just accumulate forever,
  unread.

## 3. Are calls normalized immediately?

Only the once-daily reconciliation path normalizes anything, and it does
so in a single batch when the cron fires — not per-event, not immediately.
There is no per-webhook, real-time normalization step, because (per #2)
there is no webhook-triggered normalization code at all yet.

## 4. Are daily metrics recalculated only by a scheduled job?

**No — this is not where the staleness is.** I checked
`getTodaySnapshot()` (`src/lib/data/today.ts:120` onward): it queries
`call_events` directly, filtered to today's/this week's date range, on
every single request — there is no `daily_metrics` snapshot table being
read, no memoization, no cache layer at the calculation level. If
`call_events` had a fresh row in it, the very next page load would reflect
it correctly. **The metrics math is already live; the problem is entirely
upstream, in what populates `call_events` in the first place** (#1).

## 5. Does the frontend cache stale server data?

The Today page (`src/app/(app)/today/page.tsx`) is a plain server
component under a layout marked `export const dynamic = "force-dynamic"`
(`src/app/(app)/layout.tsx`) — Next.js does **not** statically cache or
ISR-cache this route. Every navigation to it re-runs the query in #4
fresh. So there's no Next.js-level caching bug either.

## 6. Does the Today page poll, revalidate, or subscribe in real time?

**No.** I grepped `today/page.tsx` and `components/today/today-view.tsx`
for `useEffect`, `setInterval`, `revalidate`, `realtime`, `subscribe` —
zero matches. It is a static server-rendered snapshot at the moment of
page load, with **no client-side mechanism to update itself** afterward.
Even if `call_events` were updated the instant a call happened, a phone
sitting on the Today screen would not reflect it until the user manually
reloaded or re-navigated.

## Root cause, stated exactly

Two independent gaps compound into "activity only appears once a day,
around 6 PM":

1. **Ingestion frequency**: the only thing that ever writes real HighLevel
   call data into the database is a single daily cron job at 01:00 UTC
   (~6 PM Pacific). No webhook is wired up, and even the webhook receiver
   that does exist has no code path to normalize what it stores.
2. **Frontend reactivity**: even on a page load immediately after fresh
   data landed, the Today screen has no live-update mechanism — a
   left-open tab never refreshes itself.

Fixing only the frontend (e.g. adding polling) would still show data that
is up to 24 hours stale. Fixing only ingestion frequency without frontend
reactivity would require the user to manually reload every time. **Both
are required**, which is why both are addressed together below rather than
adding a cosmetic "refresh" button.

## Fix (implemented separately, see IMPLEMENTATION_PLAN.md progress log)

Given Vercel Hobby's hard cap of once/day per cron job (confirmed earlier
when setting up the daily reconciliation and the notification cron), a
*server-initiated* poll faster than daily isn't available without
upgrading hosting or adding an external scheduler. The fix instead moves
the trigger to the client, which is exactly where the person actually
needs fresh data — while the Execute screen is open on their phone during
a call block:

1. A new fast, scoped, on-demand sync function (not cron-gated — an
   ordinary authenticated route, safe to call every 20–30 seconds) pulls
   only recently-active conversations from HighLevel and upserts new
   calls, **now also linking them to the currently active work block** and
   recomputing its `calls_completed` — which the daily reconciliation
   never did either (confirmed while writing this audit: no code path
   ever set `call_events.work_block_id` for reconciled calls).
2. The Execute screen calls that route on a 20–30 second interval while
   open, and subscribes to Supabase Realtime on its own `call_events` /
   `work_blocks` rows so the UI updates the moment the sync's upsert
   commits, without a manual reload.
3. The daily cron reconciliation stays as-is, unchanged, as the accuracy
   backstop for whatever the client-driven path missed (app closed,
   device offline, etc.) — exactly the role SPEC.md describes for
   reconciliation.
4. A visible sync-status indicator (Live / Updating / "Last synced Xs
   ago" / "HighLevel connection issue") replaces the current silence about
   whether a number is current, sourced from a real last-successful-sync
   timestamp (previously nothing tracked this at all — the
   `highlevel_connections` row was written once at onboarding and never
   updated again).
