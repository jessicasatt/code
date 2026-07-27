# Setup guide (for the owner, not a developer)

You do not need to know how to code to use this guide. Each phase below is
independent — do them whenever you're ready, in order. **You don't need to do
any of them yet.** Jessica OS already works today in demo mode.

## Phase 0 — Try it now (nothing to set up)

The app is running with fictional demo data so you can see exactly what it
will feel like day to day, before connecting anything real.

1. Open the app's URL on your iPhone in Safari.
2. Tap the Share icon, then "Add to Home Screen."
3. Open it from your home screen — it should feel like a real app (no
   browser address bar).

Everything you see is labeled "Demo mode" and is fictional. Nothing you do
here is saved permanently or connected to your real business.

## Phase 1 — Connect Supabase (your private database + sign-in)

This gives you a real account and real, permanent storage instead of demo
data.

1. Go to supabase.com and create a free account, then create a new project.
   Pick any name and a strong database password (store the password
   somewhere safe — a password manager, not a chat message).
2. In your new project, go to **Project Settings → API**.
3. You'll see three values: **Project URL**, **anon public** key, and
   **service_role** key.
4. Tell me when you're on that screen. I'll tell you exactly which value to
   copy into which environment variable, one at a time, using your hosting
   platform's environment variable manager (never paste secret keys directly
   into chat).
5. I will then run the database migrations against your project so all the
   required tables exist.

## Phase 2 — Connect GoHighLevel (development mode)

1. In GoHighLevel, go to **Settings → Private Integrations** (sometimes
   under Settings → Integrations, depending on your plan).
2. Create a new Private Integration Token with read access to Calls,
   Contacts, Conversations, Opportunities, and Calendars/Appointments.
3. Copy the token and your Location ID (visible in the same settings area).
4. Tell me when you have both. I'll tell you exactly which environment
   variable to put each one in.
5. Once connected, I'll give you one specific action to trigger a single
   test outbound call so we can see exactly what GoHighLevel sends us, then
   build the real call-tracking logic around that.

## Phase 3 — Turn on notifications

1. Once push notifications are wired up (Milestone 3), open Jessica OS on
   your iPhone and tap "Enable" under Notifications in onboarding or
   Settings.
2. Approve the permission prompt iOS shows you.

No account or key is needed from you for this step — the notification
keypair is generated once during setup.

## Phase 4 — Deploy for real, permanent use

See `DEPLOYMENT.md`. In short: I'll connect the project to Vercel, add your
environment variables there (via Vercel's dashboard, not in chat), and give
you the final URL to add to your home screen in place of the local one.

## If something looks wrong

Open Settings → Export my data at any time to download everything Jessica OS
has stored about you as a single file. Settings → Delete my data permanently
removes it.
