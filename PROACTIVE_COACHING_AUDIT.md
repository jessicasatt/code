# Proactive Coaching Audit

Scope: answer the specific questions in Phase 1 before any implementation, per
the instruction "do not begin major UI changes before completing the audit."
This audit does not change any code.

## 1. How work hours are configured

- `profiles` table (`src/lib/domain/types.ts` `Profile`): `workdays` (array
  of weekday names), `calling_hours_start` / `calling_hours_end` ("HH:mm"),
  `quiet_hours_start` / `quiet_hours_end` ("HH:mm"), `morning_brief_time`,
  `end_of_day_summary_time`. Editable today in Settings
  (`src/components/settings/settings-form.tsx`).
- Timezone is **not** a per-user field anywhere. `APP_TIMEZONE =
  "America/Los_Angeles"` is a hardcoded constant in
  `src/lib/date/timezone.ts` and every date boundary in the app
  (`startOfAppDay`, `isCurrentHourMatch`, etc.) is computed against it. There
  is exactly one user today, so this has never mattered, but Phase 2's
  "Timezone" field would be the first per-user timezone setting the app has
  ever had — every `toAppTime`/`fromAppTime` call site would need to start
  taking the user's configured timezone instead of the constant.
- There is no per-weekday schedule variation (same calling hours every
  workday) and no "desired first-call time," "inactivity threshold,"
  "behind-pace tolerance," "notification cooldown count," "max proactive
  notifications/day," or "coaching intensity" field anywhere in `profiles`
  or `goals` — all of Phase 2's fields are new except workdays and calling
  hours, which already exist.
- `INACTIVITY_THRESHOLD_MINUTES = 25` and `INACTIVITY_NUDGE_COOLDOWN_MINUTES
  = 45` exist today, but as **hardcoded constants** in
  `src/lib/domain/notifications.ts`, not per-user settings.

## 2. How daily call targets are configured

- `goals` table: `daily_call_target`, `weekly_call_target`,
  `monthly_revenue_goal_cents`, `average_client_value_cents`,
  `current_mrr_cents`. Editable in Settings via `updateGoal`
  (`src/lib/data/settings.ts`).
- Block-level sizing (how big a single call block should be) is separate
  and already deterministic/configurable: `src/lib/domain/block-sizing.ts`
  (`BlockSizingConfig`: normal/restart/post-restart/high-momentum sizes,
  near-completion threshold). This is exactly the pattern Phase 3's state
  engine should extend, not replace.

## 3. How active blocks are represented

- `work_blocks` table: `status` (`scheduled | active | completed |
  cancelled`), `planned_start`/`planned_end`, `actual_start`/`actual_end`,
  `call_target`, `calls_completed`, `last_activity_at`. One row can be
  `active` per user at a time (application-enforced, not a DB constraint).
- `src/lib/data/call-blocks.ts` (`startCallBlock`, `endCallBlock`,
  `getActiveCallBlock`, `logQuickCallResult`) and
  `src/lib/highlevel/sync.ts` (`syncActiveWorkBlock`) are the only writers.
- `src/lib/data/execute.ts` (`getExecuteSnapshot`) already derives an
  `isInactive` boolean and a `suggestedBlockMode` (`normal | restart |
  post_restart_recovery | high_momentum`) from the active block plus the
  last block that ended today. This is roughly a first, narrow slice of
  Phase 3's behavioral state — it only distinguishes block-adjacent states,
  not the full state list requested (`outside_work_hours`,
  `coaching_paused`, `data_stale`, `not_started`, `late_start`,
  `behind_pace`, `daily_target_complete`, etc.).

## 4. How HighLevel events enter the app

Three paths, same as documented in `DATA_FLOW_AUDIT.md`, still accurate:

1. **On-demand sync** (`POST /api/highlevel/sync-now`,
   `src/lib/highlevel/sync.ts`) — scoped to the active block's time window,
   called by the Execute screen every ~25s **while that screen is open**.
   This is the primary real-time path today.
2. **Daily reconciliation cron** (`/api/cron/reconcile-highlevel`, fires
   once around 6pm Pacific) — broad sweep, historical rollup, not
   real-time.
3. **Webhook receiver** (`/api/webhooks/highlevel/[secret]`) — stores raw
   payloads into `raw_webhook_events` but nothing normalizes them into
   `call_events`, and no GoHighLevel workflow currently calls it. Dead path
   today (task #20 in the tracker, still pending).

**Critical implication for proactive coaching**: path 1, the only
real-time path, only runs while a human has the Execute screen open in a
browser tab. There is currently no mechanism that observes HighLevel
activity when the app is closed. This directly affects Phase 3/4 — see
"Architectural constraint" below.

## 5. How notification scheduling currently works

Two mechanisms, both gated by `isNotificationEligible` (category enabled +
outside quiet hours):

- **Event-driven** (`src/lib/notifications/triggers.ts`): fired
  synchronously the instant something happens — a call is logged and hits
  the block target or the near-completion threshold
  (`src/lib/data/call-blocks.ts`, `src/lib/highlevel/sync.ts`), or the
  on-demand sync detects the active block has gone inactive
  (`notifyInactivityIfEligible`, cooldown-gated via
  `canSendInactivityNudge`, 45 min). All of these require either a call to
  have just been logged, or the Execute screen to be open and polling —
  none of them fire from nothing.
- **Scheduled** (`/api/cron/scheduled-notifications`): an hourly sweep (24
  `vercel.json` cron entries, one per hour — see "Background jobs" below)
  that checks `morning_brief`, `end_of_day_summary`, `behind_weekly_pace`,
  `follow_up_due`, `weekly_review` against the user's configured times and
  a `notification_deliveries` dedup query. This is genuinely background
  (doesn't need the app open) but only fires at whichever single hour
  matches a configured time — it cannot notice "it's been quiet for the
  last 40 minutes" or "you haven't started yet and it's later than usual,"
  because it only runs once, at the top of an hour.

## 6. Whether background jobs are supported

- Vercel **Hobby plan**: a given cron job can fire **at most once per
  calendar day**, no matter what schedule expression you give it. This
  project already works around that for hour-granularity checks by
  defining the *same* route as 24 separate cron entries in `vercel.json`
  (one per hour, 0–23) — each entry individually complies with "once per
  day," and the net effect is an hourly sweep. That's `vercel.json`'s 24
  `scheduled-notifications` entries + 1 `reconcile-highlevel` entry = 25
  cron jobs total today.
- There is no mechanism for anything finer than hourly. A cron-based check
  for "have you been idle for 20 minutes" independent of the app being
  open is not possible on this hosting tier without either (a) upgrading
  the Vercel plan, or (b) an external scheduler (e.g. a third-party cron
  ping service hitting an authenticated endpoint every few minutes) that
  lives outside Vercel entirely.
- This is the same root constraint the previous audit (`DATA_FLOW_AUDIT.md`)
  worked around by moving to client-driven on-demand sync — but that
  workaround only works because a human has the Execute screen open. It
  does not help with "notice I never opened the app at all today."

## 7. What user activity history already exists

- `call_events`, `work_blocks`: full history, real data.
- `behavioral_checkins`: one-tap "what interrupted you" answers, with
  `resumed_within_10/30/60_min` — now actually populated (as of the last
  round of work) by `src/lib/data/behavioral-metrics.ts`, called from both
  the manual log-result path and the real-time sync path.
- `src/lib/domain/behavioral-metrics.ts`: pure calculation functions
  (activation time, restart time, recovery rate, block completion rate,
  interruption-reason counts, intervention effectiveness) already exist
  and are unit-tested, and `src/lib/data/patterns.ts` already surfaces a
  sample-size-gated subset of them on the Patterns page.
- `interventions` table: **schema exists, nothing writes to it.** This is
  exactly the table Phase 3/4's intervention engine would need
  (`behavioral_checkin_id`, `kind`, `payload jsonb`) — it was created
  early in the project in anticipation of this feature but has zero rows
  today.
- `daily_metrics` / `weekly_metrics` tables: **schema exists, nothing
  writes to them.** No rollup job populates them. `getExecuteSnapshot` and
  `getReviewSnapshot` both compute everything live from `call_events` /
  `work_blocks` instead of reading these tables. This matters for "learn
  which interventions tend to work best over time" — that kind of
  cross-day trend analysis has no historical store to read from yet beyond
  the raw event tables themselves (which is workable, just unindexed for
  that purpose).

## 8. What AI or chat infrastructure already exists

**None.** `OPENAI_API_KEY` is a reserved-but-unused env var
(`src/lib/env.ts`), with an `isAiConfigured()` helper defined and **never
called anywhere in the codebase**. There is no chat UI, no conversation/
message table, no LLM call site, no prompt template, no structured-output
schema. SPEC.md refers to AI hypotheses as a future milestone with a hard
rule: the model must never calculate factual state itself, only receive it
— which matches this request's explicit instruction. Phase 4 (coaching
chat) is a from-scratch build, not an extension of something partial.

## Architectural constraint that affects the whole plan

The single biggest fact from this audit: **the app cannot currently notice
anything while it is closed, more often than once an hour.** Everything
proactive that exists today either fires from an event that already
happened (a call was logged) or from an hourly sweep. True "notice at
9:15am that I still haven't started" or "notice at 2:40pm that it's been
quiet for 20 minutes" **without the Execute screen open** is not buildable
on the current hosting tier without one of:

1. An external scheduler (e.g. a free-tier third-party cron-ping service)
   hitting a new authenticated endpoint every few minutes — no Vercel plan
   change needed, but a new external dependency the product owner would
   need to set up (another account, another URL to protect).
2. Upgrading off the Vercel Hobby plan, which allows arbitrary cron
   frequency directly.
3. Accepting that proactive checks only run at hourly granularity (already
   supported today, no new infrastructure) — "not started by your desired
   first-call time" and "behind pace" both fit an hourly cadence fine, but
   "you went quiet mid-block 20 minutes ago" does not, since a mid-block
   pause is exactly the kind of thing that needs finer-than-hourly
   resolution to catch while it's still fixable.

This should be decided before Phase 3 is implemented, since it determines
whether the behavioral state engine's `nextEvaluationAt` field is driven by
an hourly cron, a finer external scheduler, or a hybrid (hourly cron for
non-time-critical checks, client-side polling for anything that needs the
app open anyway).

## Existing functionality this work must not disturb

- Call block start/end/log-result flow (`src/lib/data/call-blocks.ts`).
- The Execute screen's five states and its on-demand sync
  (`src/components/execute/execute-view.tsx`,
  `src/lib/highlevel/sync.ts`).
- Event-driven and scheduled notifications as they exist today
  (`src/lib/notifications/triggers.ts`,
  `/api/cron/scheduled-notifications`).
- Patterns/Review pages and the behavioral-metrics data model.

None of the above needs to change shape — Phase 2's settings are additive
fields on `profiles`/a new settings table, Phase 3's state engine is a new
pure function that can *read* `getExecuteSnapshot`'s output plus schedule
config rather than replacing it, and Phase 4's chat is a new page/route
that *reads* factual state rather than computing it.

## Proposed smallest safe implementation plan

1. **Phase 2 — coaching settings**: add a `coaching_settings` table (or
   extend `profiles`/`goals` — leaning toward a new table since these are
   conceptually distinct from revenue/schedule config and need their own
   pause/timezone/intensity fields) with the fields listed, a
   `coaching_paused_until: timestamptz | null` + `vacation_mode: boolean`
   for the pause options, and a Settings UI section. Timezone becomes a
   real per-user field for the first time — every `APP_TIMEZONE` call site
   needs to switch to reading it (mechanical but touches many files;
   defaulting existing users to `America/Los_Angeles` keeps it a no-op
   until changed).
2. **Phase 3 — behavioral state engine**: a pure function in
   `src/lib/domain/behavioral-state.ts`, unit-tested like
   `block-sizing.ts`, taking exactly the inputs in the type you specified.
   It composes with (not replaces) `getExecuteSnapshot` — the Execute
   screen's existing `isInactive`/`suggestedBlockMode` logic can be
   subsumed into this engine's broader state list rather than living
   separately.
3. **Decide the background-cadence question above** before building the
   intervention engine, since it determines whether "not started by X" and
   "quiet for 20 minutes while app is closed" are both in scope for v1 or
   only the former.
4. **Phase 3.5 — intervention engine**: a deterministic mapping from
   `BehavioralState` → notification copy + cooldown/max-per-day check,
   writing to the (currently empty) `interventions` table so outcomes can
   be tracked. Reuses the existing `notifyUser`/cooldown infrastructure
   rather than building new send logic.
5. **Phase 4 — coaching chat**: new page + API route. Requires
   `OPENAI_API_KEY` to actually be set (it isn't yet — this is a new cost
   and a new external dependency the product owner needs to provision).
   Structured factual context (current `BehavioralState` + recent
   `behavioral-metrics` output) gets assembled in application code and
   passed to the model; the model never computes state itself, per your
   instruction and the standing SPEC.md rule.
6. **Learning over time**: once `interventions` rows exist with outcomes
   (did a call happen within N minutes of the nudge — same pattern as
   `resolveCheckinResumption`), `behavioral-metrics.ts` gets a new
   "intervention effectiveness by kind" calculation, surfaced on Patterns
   once sample size supports it.

Each phase after this audit is independently shippable and none of them
require touching the call-block system itself.
