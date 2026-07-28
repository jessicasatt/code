# Deployment

Target platform: **Vercel** (Next.js's native platform; nothing in this
repo assumes it, but no alternative is configured yet).

## Before deploying

Run these locally and confirm all pass — the same checks CI/deployment
should gate on:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run validate:deploy
```

## First deployment

1. Push this repository to GitHub (or your git host of choice).
2. In the Vercel dashboard, import the repository as a new project.
   Framework preset: Next.js (auto-detected).
3. Add environment variables under **Project Settings → Environment
   Variables** — do not put secrets in `vercel.json` or commit them. See
   `.env.example` for the full list and `SETUP.md` for where each value
   comes from.
   - At minimum for a real (non-demo) deployment:
     `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`.
   - Add HighLevel, VAPID, and `CRON_SECRET` variables once those
     milestones are wired up.
4. Apply the SQL migrations in `supabase/migrations/` to your Supabase
   project (Supabase Dashboard → SQL Editor, run each file in order, or via
   `supabase db push` if you have the Supabase CLI installed locally).
5. Deploy. Vercel builds with `npm run build` automatically.
6. Visit the deployed URL, sign in, complete onboarding, and add the app to
   your iPhone home screen (Share → Add to Home Screen).

## Redeploying

Vercel redeploys automatically on every push to the connected branch.
Database migrations are **not** run automatically — apply new files in
`supabase/migrations/` manually (or wire up a migration step in CI) before
or immediately after a deploy that depends on schema changes.

## Scheduled jobs

`vercel.json` defines Vercel Cron entries calling authenticated API routes,
gated by the `CRON_SECRET` environment variable (Vercel automatically sends
it as the `Authorization: Bearer` header for cron-triggered requests — no
extra wiring needed once the env var is set). No separate infrastructure
required.

Live today: `/api/cron/reconcile-highlevel` runs once a day, pulling recent
HighLevel call activity. Vercel's **Hobby plan caps native cron at once per
day** — cron expressions requesting anything more frequent fail at deploy
time. More jobs (morning brief, inactivity checks, end-of-day summary,
weekly review) are added the same way in Milestone 3.

If more-than-daily HighLevel reconciliation is wanted before upgrading off
Hobby, trigger the same endpoint from a free external scheduler (e.g.
cron-job.org) instead — it's just an authenticated `GET` request.

## Rolling back

Use Vercel's dashboard to instantly promote a previous deployment if a
release causes problems. This does not roll back database migrations —
treat migrations as forward-only and additive where possible.
