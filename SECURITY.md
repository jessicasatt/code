# Security

This is a private, single-user application. The threat model is narrower
than a multi-tenant SaaS product, but the same discipline is applied
anyway — see SPEC.md rule 12 ("do not take unsafe shortcuts").

## Secrets

Never exposed to the browser (server-only environment variables, no
`NEXT_PUBLIC_` prefix): `SUPABASE_SERVICE_ROLE_KEY`,
`HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN`, `HIGHLEVEL_WEBHOOK_SHARED_SECRET`,
`VAPID_PRIVATE_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`. `src/lib/env.ts`
validates every environment variable with Zod at first use and separates
the server-only schema from the public (`NEXT_PUBLIC_*`) schema, so a
server-only value can never accidentally end up in a client bundle via a
shared object.

`src/lib/supabase/admin.ts` (the service-role client that bypasses RLS) is
marked with the `server-only` package, which throws a build error if any
client component ever imports it, even transitively.

## Row Level Security

Every user-owned table has RLS enabled with an `auth.uid() = user_id`
policy for all operations (see
`supabase/migrations/20260727000007_row_level_security.sql`). Server
components and actions use a per-request Supabase client bound to the
signed-in user's session (`src/lib/supabase/server.ts`), so ordinary reads
and writes are enforced by Postgres itself, not just application code. The
service-role client is reserved for the webhook receiver (which has no
user session to bind to) and scheduled jobs.

## Authentication

Supabase Auth magic-link (passwordless email). No passwords are stored by
this application. Session cookies are refreshed on every request by
`src/proxy.ts` (Next.js 16's `middleware.ts` replacement).

## Webhooks

Not yet implemented (Milestone 2). When built: rate-limited, idempotent
(dedup key derived from the provider's event id or a content hash — see
`src/lib/highlevel/webhook.ts`), raw payload stored before any parsing, and
documented explicitly in `HIGHLEVEL_INTEGRATION.md` as to what signature
verification is and isn't performed for this specific integration type.

## Client-visible debugging

The planned Webhook Inspector screen redacts phone numbers, email
addresses, tokens/secrets, and recording URLs from any payload shown in the
UI (`src/lib/highlevel/redact.ts`, unit-tested). Raw payloads remain
available only via direct, RLS-protected database access.

## Money

All monetary values are integer cents (`src/lib/domain/money.ts`). No
floating-point arithmetic is used for revenue calculations, eliminating an
entire class of rounding-based data integrity bugs.

## Data export and deletion

`GET /api/data-export` returns everything the signed-in user owns as JSON.
`deleteMyDataAction` removes every row owned by that user across all
app-owned tables. Both are user-initiated only — nothing is exported or
deleted automatically.

## Demo mode

The in-memory demo store contains only fictional data and is never mixed
with real Supabase-backed records — the two code paths are selected
exclusively by whether Supabase environment variables are present
(`isSupabaseConfigured()`), with no partial/mixed state possible.

## Dependency vulnerabilities

`npm audit` reports advisories in transitive build-tooling dependencies
(ESLint's `minimatch`/`brace-expansion` chain, `postcss`, `sharp`) pulled
in by Next.js/ESLint themselves. These affect the build toolchain, not
runtime request handling, and the suggested fixes downgrade Next.js to an
unsupported major version — not applied. Re-check `npm audit` when
upgrading dependencies.

## Known gaps for v1

- Webhook signature verification: not yet applicable (no receiver built
  yet) — will be documented precisely once built.
- CSP / security headers: not yet configured in `next.config.ts`; add
  before a real public-facing deployment.
- Rate limiting on API routes: not yet implemented — required before the
  webhook receiver goes live (SPEC.md requirement), tracked in
  `IMPLEMENTATION_PLAN.md` Milestone 2.
