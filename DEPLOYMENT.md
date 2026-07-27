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

Once Milestone 3 lands, recurring jobs (morning brief, inactivity checks,
end-of-day summary, weekly review, reconciliation) run via Vercel Cron
(`vercel.json` `crons` entries calling authenticated API routes, gated by
`CRON_SECRET`). Vercel Cron requires no separate infrastructure — it's part
of the Vercel project.

## Rolling back

Use Vercel's dashboard to instantly promote a previous deployment if a
release causes problems. This does not roll back database migrations —
treat migrations as forward-only and additive where possible.
