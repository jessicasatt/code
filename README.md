# Jessica OS

A private, mobile-first PWA that helps one person (Jessica) track outbound sales
activity synced from GoHighLevel, compare it against daily/weekly call
targets, and surface a single next action toward a $10,000/mo recurring
revenue goal. See `SPEC.md`-derived `IMPLEMENTATION_PLAN.md` for full scope
and milestones.

Not a technical audience? Start with `SETUP.md` instead — it's written for
the product owner, one step at a time.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no Supabase environment variables set, the
app runs entirely in **demo mode** — fictional businesses and call activity,
no external services required — so the whole product is clickable and
testable immediately.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run seed:demo` | Seed fictional demo data into a **connected Supabase project** |
| `npm run reset:demo` | Wipe and re-seed demo data in a connected Supabase project |
| `npm run generate:vapid` | Generate a Web Push VAPID keypair |
| `npm run generate:icons` | Regenerate the temporary placeholder app icons |

## Project docs

- `SETUP.md` — nontechnical, one-action-at-a-time setup guide
- `ARCHITECTURE.md` — how the app is structured and why
- `HIGHLEVEL_INTEGRATION.md` — connection modes, webhook status, what's verified
- `DEPLOYMENT.md` — deploying to Vercel
- `SECURITY.md` — what's protected and how
- `IMPLEMENTATION_PLAN.md` — milestones and current progress

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 · Supabase
(Postgres, Auth, RLS) · Zod · date-fns / date-fns-tz · Web Push · Vitest ·
Playwright.
