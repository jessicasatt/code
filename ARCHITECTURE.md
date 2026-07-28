# Architecture

## Stack

- **Next.js App Router** (v16, TypeScript strict, Turbopack) for the app
  shell, server actions, and API routes.
- **Supabase** (Postgres + Auth + Row Level Security) as the system of
  record for everything Jessica OS itself owns. GoHighLevel remains the
  source of truth for CRM data; Supabase holds a local mirror plus
  Jessica-OS-specific state (goals, work blocks, check-ins, metrics).
- **Tailwind CSS v4** for styling, using CSS-first `@theme` tokens in
  `src/app/globals.css` for the warm/charcoal/gold design system.
- **Zod** for all environment and request/payload validation.
- **date-fns / date-fns-tz** for timezone-safe math, always against
  `America/Los_Angeles` (`src/lib/date/timezone.ts`), never browser-local
  time.
- **Vitest** (unit) and **Playwright** (e2e, iPhone viewport via Chromium).

## Directory layout

```
src/
  app/                    Routes (App Router). (app)/ route group = the
                           authenticated shell with bottom nav.
  components/              Client-side UI, grouped by feature.
  lib/
    domain/                Pure, dependency-free business logic: money,
                            revenue-goal math, pace calculation, next-action
                            selection, notification eligibility rules,
                            shared types. No I/O. Fully unit-tested.
    date/                   Timezone helpers.
    data/                   Data-access layer — one function per read/write
                            the UI needs, each branching between "demo mode"
                            and "Supabase mode" (see below).
    demo/                   Fictional fixtures + an in-memory demo store.
    highlevel/              The HighLevelProvider interface, a demo
                            implementation, and a Private-Integration-Token
                            implementation.
    supabase/               Browser/server/admin Supabase client factories.
    env.ts                  Zod-validated environment access + feature
                            flags (isSupabaseConfigured, etc).
  proxy.ts                  Next.js 16's replacement for middleware.ts —
                            refreshes the Supabase session cookie.
supabase/migrations/         Hand-written SQL migrations (no dashboard-
                            created tables).
scripts/                     One-off Node scripts (seed/reset demo data,
                            generate icons/VAPID keys).
e2e/                         Playwright specs.
```

## The demo/Supabase dual path

Every data-access function in `src/lib/data/*` starts with:

```ts
if (!isSupabaseConfigured()) {
  return /* read/write against the in-memory demo store */;
}
/* read/write against Supabase, scoped to the signed-in user via RLS */
```

This isn't a mock — it's a real, fully interactive second backend, so the
whole product is usable and testable with zero external accounts. The demo
store (`src/lib/demo/store.ts`) is an in-memory singleton, cached on
`globalThis` so it survives Next.js dev-server hot reloads. It intentionally
does **not** persist across server restarts or serverless cold starts —
demo mode is a local evaluation aid, not a deployment target. Once
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, every
data function switches to the real Supabase path automatically; no code
changes needed.

Any authenticated page whose rendering depends on this per-request state
(the demo store, or the signed-in user's session) is marked
`export const dynamic = "force-dynamic"`. Without it, Next.js can't tell the
demo-mode code path is dynamic (it makes no `cookies()`/`headers()` calls)
and will statically prerender the page once at build time — which would
silently freeze it at whatever the demo data looked like during `next
build`.

## The HighLevel provider interface

`src/lib/highlevel/provider.ts` defines a single interface —
`getContacts`, `getConversations`, `getCalls`, `getOpportunities`,
`getAppointments`, `refreshConnection`, `reconcileActivity` — that all UI
and domain code depends on. Two implementations exist today:

- `DemoHighLevelProvider` — backs the interface with fixture data.
- `PrivateIntegrationHighLevelProvider` — development-mode connection using
  a Private Integration Token + Location ID (server-only env vars).
  `refreshConnection()` is safe to call today (it only verifies the
  credential against a stable, documented endpoint); the data-fetching
  methods throw `NotYetImplementedError` until a real payload has been
  inspected (see `HIGHLEVEL_INTEGRATION.md` — SPEC.md explicitly forbids
  fabricating the webhook/API payload shape).

`src/lib/highlevel/index.ts` exports `getHighLevelProvider()`, which picks
the right implementation from environment configuration. When OAuth support
is added later, it becomes a third implementation behind the same
interface — no caller changes.

## Money and time

- All money is integer cents (`src/lib/domain/money.ts`). No float ever
  touches a monetary calculation.
- All "today"/"this week"/pace calculations go through
  `src/lib/date/timezone.ts`, which is DST-correct for
  `America/Los_Angeles` (verified in `timezone.test.ts` against the actual
  2026 spring-forward transition).

## Fact vs. calculation vs. hypothesis

Per SPEC.md rule 8, the codebase keeps these separate:

- **Recorded fact**: a row in `call_events`, `appointments`, etc. — data
  HighLevel or the user directly reported.
- **Calculated metric**: a pure function in `src/lib/domain/*` deriving a
  number from recorded facts (pace, remaining MRR, clients needed).
- **AI hypothesis**: not implemented yet (Milestone 5). When it lands, it
  is required to go through a Zod-validated structured-output contract and
  is visually/textually labeled as a hypothesis, never presented as fact.

## PWA

`public/manifest.webmanifest` + `public/sw.js` (hand-written, no framework)
provide installability, standalone display, an offline fallback
(`/offline`), and the Web Push `push`/`notificationclick` handlers used
once VAPID is configured. Safe-area insets are applied via `.safe-top` /
`.safe-bottom` / `.safe-x` utility classes in `globals.css`.

## Notifications

Two delivery paths, both gated by the same eligibility check
(`isNotificationEligible` in `src/lib/domain/notifications.ts`: category
enabled + outside quiet hours):

- **Event-driven** (`src/lib/notifications/triggers.ts`, called directly
  from `src/lib/data/call-blocks.ts`) — fires the instant a call block
  hits its target or drops to 3 calls remaining. No schedule involved.
- **Scheduled** (`/api/cron/scheduled-notifications`) — an hourly sweep
  (24 `vercel.json` cron entries, one per hour, each individually
  Hobby-plan-compliant — see DEPLOYMENT.md) that checks every time-based
  category against the user's configured times and a
  `notification_deliveries` dedup query, so it's safe to run hourly
  without spamming.

Categories requiring true real-time checks (inactivity mid-block, block
starting soon, no call logged yet) are listed in
`CATEGORIES_REQUIRING_FREQUENT_SCHEDULING` and shown as unavailable in
Settings rather than silently not firing — building them without the
infrastructure to actually check every few minutes would mean shipping
something that looks configured but never works.

`src/lib/notifications/send.ts` wraps `web-push`, sends to every
subscription a user has (usually one device, but not enforced), deletes
subscriptions the push service reports as expired (410/404), and logs one
`notification_deliveries` row per attempt regardless of outcome.
