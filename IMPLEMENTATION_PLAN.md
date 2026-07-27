# Jessica OS v1 — Implementation Plan

## Repository state at start

- Empty git repository (no commits, no remote branches, no existing code).
- Node v22.22.2 / npm v10.9.7 available. Docker present but no Supabase CLI installed yet.
- This is a greenfield build. Nothing to preserve or avoid rewriting.

## Assumptions (stated per spec instruction, proceeding without waiting for approval)

1. **No Supabase project exists yet.** I will write full SQL migrations and app code against Supabase, but cannot run them against a live database until the product owner creates a Supabase project and provides its URL + keys via environment variables. Until then, the app runs in a self-contained **demo mode** (fixture data, no network calls) so it is fully clickable and testable now.
2. **No HighLevel account/credentials configured yet.** The HighLevel provider is built behind an interface (`getContacts`, `getConversations`, `getCalls`, `getOpportunities`, `getAppointments`, `refreshConnection`, `reconcileActivity`) with a `DemoHighLevelProvider` now and a `PrivateIntegrationProvider` (PIT + Location ID) implemented but inert until real credentials exist. Per spec, real payload shape is not fabricated — the webhook normalizer is built generically (raw storage + passthrough) until a real test call's payload is inspected together with the owner.
3. **No VAPID keys / push credentials yet.** Push subscription plumbing (service worker, subscribe route, DB tables) is built now; sending real pushes and the notification scheduler land in Milestone 3 once VAPID keys are generated (I can generate the VAPID keypair myself with `web-push` — no owner action needed for that specific step — but the owner must supply the app identity/email used in `mailto:` subject, which I'll default sensibly).
4. **No Vercel/hosting account connected.** I will get the app running and tested locally (`npm run dev`, unit + e2e tests, production build). Actual deployment is a later, explicit step requiring the owner to connect a Vercel project.
5. **Timezone**: all business logic uses `America/Los_Angeles` via `date-fns-tz`, computed server-side/in pure functions (never relying on browser-local time for scheduling decisions).
6. **Money**: all monetary values stored and computed as integer cents. No floats in revenue math.
7. Single user, single tenant. RLS still applied correctly (defense in depth) even though only one `auth.uid()` will ever exist in practice.
8. Node package manager: npm (matches installed toolchain).

## Technology choices

- Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind CSS v4.
  (Next 16 renamed `middleware.ts` to `proxy.ts` and made `cookies()` /
  `params` / `searchParams` fully async — confirmed against the vendored
  Next 16 docs before writing any route code, and reflected throughout.)
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`) for Postgres + Auth + RLS.
- Zod v4 for env validation and API/webhook payload validation.
- `date-fns` + `date-fns-tz` for timezone-safe math.
- Vitest (unit/integration), Playwright (e2e, Chromium with iPhone 13 viewport/UA — WebKit isn't installed in this environment).
- Web Push via `web-push` npm package + hand-written service worker.
- Deployment target: Vercel (added later once owner connects account).

## Milestone plan (build in this order; tests must pass before moving on)

### Milestone 1 — Clickable private demo
App shell, magic-link auth pages + protected routes, onboarding flow, Today screen, Call blocks (start/end, demo-driven progress), full DB schema migrations (all tables from spec, even though only a subset is wired to UI yet), demo data seed + reset script, PWA installability (manifest, service worker, offline page, icons, safe-area), Settings (subset), revenue goal engine + unit tests, Playwright e2e for the golden path.

### Milestone 2 — HighLevel observation
Webhook receiver route, raw payload storage, dedup, Webhook Inspector screen, HighLevel provider interface + PIT-based dev implementation, connection test route, reconciliation skeleton. Real normalization rules land only after inspecting one real test payload with the owner (per spec, not fabricated now).

### Milestone 3 — Notifications
VAPID keypair, push subscription route + storage, service worker push handling, notification preference model, scheduler (Vercel Cron / Supabase Edge cron), deterministic nudge rules, cooldowns, deep links.

### Milestone 4 — Reporting
Daily/weekly metrics jobs, Daily Review and Weekly Review screens, behavioral check-ins, Patterns screen (factual observations only).

### Milestone 5 — Optional AI coaching
Structured-JSON coaching interface behind a provider abstraction, gated entirely behind an optional `OPENAI_API_KEY`; app fully functional without it.

## What happens in this session

Given the size of this spec, this session focuses on getting **Milestone 1 fully working end-to-end** (typecheck, lint, unit tests, e2e tests, production build all green; app runs locally in demo mode without any external credentials) plus the **complete database migration set** for all tables listed in the spec (so later milestones only need to wire up code, not schema), plus the HighLevel provider interface skeleton (Milestone 2 architecture, no live integration yet). Docs (`README.md`, `SETUP.md`, `ARCHITECTURE.md`, `HIGHLEVEL_INTEGRATION.md`, `DEPLOYMENT.md`, `SECURITY.md`) are written alongside.

After Milestone 1 is verified green, I will report status and give one precise next action (expected: create a Supabase project and hand me the URL/keys via env vars) before continuing into Milestone 2.

## Progress log

- [x] Scaffold Next.js + TS + Tailwind + tooling
- [x] Full DB migrations (all 17 tables — verified by applying them to a real local Postgres with a stubbed `auth` schema; all tables created, RLS enabled on every one)
- [x] Env validation (Zod)
- [x] Domain layer: revenue goal engine, HighLevel provider interface, demo provider
- [x] Auth pages (magic link) + protected shell
- [x] Onboarding flow
- [x] Today screen (demo data)
- [x] Call blocks (start/end, demo progress)
- [x] Settings (subset)
- [x] PWA (manifest, service worker, icons, offline page)
- [x] Demo seed/reset scripts
- [x] Unit tests (57 tests: money, revenue/pace math, timezone incl. DST boundary, notification cooldowns/inactivity, webhook dedup/normalization, next-action selection)
- [x] E2E tests (9 Playwright specs against a real production build: sign-in, onboarding, Today screen, call block start/log/end, behavioral check-in, settings persistence, daily review)
- [x] Docs (README, SETUP, ARCHITECTURE, HIGHLEVEL_INTEGRATION, DEPLOYMENT, SECURITY)
- [x] Typecheck/lint/test/build all green
- [ ] Commit + push

## Milestone 1 report

**What now works:** Sign-in (magic link when Supabase is configured, one-tap
demo continue otherwise), onboarding, the Today screen (MRR progress, call
pace, next action, stats), starting/ending call blocks with live progress,
logging a quick result, a two-tap behavioral check-in when a block ends
early, Settings (revenue goal, schedule, data export/delete, sign out),
Pipeline/Patterns/Review stub screens, PWA installability with an offline
fallback and placeholder icons, and the full 17-table Supabase schema with
RLS. All of this runs immediately in demo mode with zero external
credentials.

**What was tested:** 57 unit tests (Vitest) covering every deterministic
calculation in the spec's "Unit tests" list that's in scope for Milestone 1
(money, revenue/pace math, timezone + DST boundaries, notification
cooldowns, active-block inactivity, webhook dedup/normalization). 9
Playwright e2e specs against a real `next build && next start` production
build on an iPhone 13 viewport, covering the golden path end to end. `npm
run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run
test:e2e` all pass.

Two real bugs were caught and fixed during e2e testing (both would have
shipped silently otherwise): (1) authenticated pages were being statically
prerendered at build time in demo mode because no code path there calls a
Next.js "dynamic" API, so runtime demo-state changes were invisible until
`force-dynamic` was added explicitly; (2) an HTML5 `<input type="number"
step={50}>` whose default value wasn't aligned to that step silently
blocked native form submission with no visible error, which onboarding's
average-client-value field had.

**Unresolved limitations (by design, per the spec's milestone order):**
HighLevel webhook receiver, normalization, and the Webhook Inspector don't
exist yet (Milestone 2 — normalization is intentionally not fabricated
without a real payload). Push notifications, the scheduler, and
notification preferences are UI-stubbed but not wired (Milestone 3). Daily
and weekly metrics rollups and the fuller Review/Patterns screens are
placeholders (Milestone 4). AI coaching is not started (Milestone 5, by
design). Deployment to Vercel has not happened — this was built and
verified locally only.

**The single next action:** see the end-of-session message for the one
precise step to take next.
