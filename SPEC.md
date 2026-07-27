# Jessica OS v1 - Build Specification

You are the lead engineer and product designer building Jessica OS v1, a private mobile-first Progressive Web App for one user.

Do not merely provide instructions or sample code. Create the application in the current repository, run it locally, write tests, diagnose errors, and continue until the MVP is operational or you are blocked by credentials or an external account action.

When blocked, give me one precise action at a time. Explain exactly where to click, what value to copy, and where to place it. Do not overwhelm me with a long setup list.

## Product objective

Jessica OS helps me reach $10,000 per month in recurring revenue selling GEO services to businesses.

Its primary job is to:
1. Automatically track my outbound sales activity from GoHighLevel.
2. Compare actual activity against daily and weekly targets.
3. Show me the single best action to take next.
4. Send timely iPhone notifications when I am falling behind or stop during a call block.
5. Identify behavioral patterns without pretending to know my emotions.
6. Require minimal manual data entry.

This is not a replacement for GoHighLevel. GoHighLevel remains the source of truth for calls, contacts, opportunities, appointments, and pipeline data.

## User experience

I should only need to use:
- GoHighLevel for making calls and managing prospects.
- Jessica OS as an app added to my iPhone home screen.

I should not need to interact with Supabase, databases, deployment tools, terminals, or automation software after initial setup.

The app must be designed primarily for an iPhone screen. It should feel calm, premium, focused, and extremely simple.

Do not build a generic productivity dashboard. Build a sales execution coach.

## Technology

Use this stack unless the existing repository strongly supports a better equivalent:
- Next.js App Router
- TypeScript with strict mode
- Tailwind CSS
- Supabase Postgres
- Supabase Auth
- Supabase Row Level Security
- Supabase Edge Functions or secure Next.js server routes
- HighLevel official API or official Node SDK
- Web Push using a service worker and VAPID
- Vitest for unit tests
- Playwright for critical end-to-end tests
- Zod for request and environment validation
- date-fns or Luxon for timezone-safe date calculations
- Vercel for deployment unless an existing platform is already configured

Use the timezone America/Los_Angeles.

Create a mobile-first PWA with:
- Web app manifest
- Installable home-screen behavior
- Standalone display mode
- Service worker
- Push notification subscription
- App icons using simple temporary generated assets
- Proper iPhone safe-area spacing
- Offline fallback page

## Important engineering rules

1. Never expose HighLevel tokens, Supabase service keys, VAPID private keys, or AI keys in browser code.
2. Validate every environment variable at application startup.
3. Make webhook handling idempotent.
4. Store raw webhook payloads before normalizing them.
5. Do not assume the exact HighLevel call payload.
6. Create a webhook inspection/debug view so we can see the actual events delivered by my HighLevel account.
7. Build reconciliation jobs so missed webhooks can eventually be corrected from the HighLevel API.
8. Clearly distinguish:
   - Recorded fact
   - Calculated metric
   - AI-generated hypothesis
9. Never claim that I am anxious, distracted, afraid, or avoiding something unless I explicitly select that reason.
10. Do not send prospect messages, modify HighLevel records, or make autonomous calls in v1.
11. Favor deterministic rules before adding AI.
12. Keep the architecture appropriate for a private single-user MVP, but do not take unsafe shortcuts.
13. Use cents or decimal-safe types for money. Never use floating-point arithmetic for revenue.
14. The application must be usable without an OpenAI API key initially. AI summaries are an optional enhancement after deterministic features work.

## First task: inspect and plan

Before changing files:
1. Inspect the repository.
2. Identify the existing framework and dependencies.
3. Read any project instructions such as CLAUDE.md, README.md, AGENTS.md, or environment examples.
4. Check git status.
5. Create a concise implementation plan in IMPLEMENTATION_PLAN.md.
6. State any assumptions.
7. Then begin implementing without waiting for approval unless the repository contains a destructive conflict.

Do not rewrite working code unnecessarily.

## MVP scope

### 1. Authentication and onboarding

The app is private and single-user in v1.

Onboarding should collect:
- Name
- Monthly recurring revenue goal, default $10,000
- Current recurring revenue
- Average monthly GEO client value
- Desired workdays
- Daily call target
- Weekly call target
- Morning brief time
- End-of-day summary time
- Normal calling hours
- Notification permission
- HighLevel connection status

Support secure email magic-link authentication.

Create a protected app shell.

### 2. Today screen

This is the default screen.

Display:
- Current MRR / $10,000
- Remaining MRR
- Estimated additional clients required
- Calls today / target
- Human answers, only when supported by real data
- Meaningful conversations
- Appointments booked
- Follow-ups due
- Current call block
- Pace status: ahead, on pace, or behind
- One next recommended action

Include large buttons:
- Start call block
- End call block
- Log quick result
- Review today

Avoid excessive charts.

The primary message must be action-oriented, for example: "Complete 7 more calls before 11:30 AM."

Do not display unsupported probability estimates such as "61% likely to hit goal."

### 3. Call blocks

Allow me to schedule or start an immediate call block.

A call block contains:
- Planned start
- Planned end
- Actual start
- Actual end
- Call target
- Calls completed
- Status

While a block is active, HighLevel call events should update its progress automatically.

The application should recognize inactivity only inside an active call block.

### 4. HighLevel integration

Support two connection modes in this order:

**Development mode**
Allow configuration using a HighLevel Private Integration Token and Location ID through secure server-side environment variables. Use this first because this is initially a private app.

**Future mode**
Structure the integration so OAuth can be added later without rewriting the domain layer.

Create a provider interface such as: getContacts, getConversations, getCalls, getOpportunities, getAppointments, refreshConnection, reconcileActivity.

Do not hard-code HighLevel logic into UI components.

Implement:
- Secure webhook endpoint
- Raw payload storage
- Webhook event-type detection
- Event deduplication
- Normalization pipeline
- Webhook processing status
- Error logging
- Retry-safe handlers
- Manual reprocess action in development
- A protected integration diagnostics page

Create a "Webhook Inspector" screen that shows:
- Received time
- Event type
- Processing status
- External event ID
- Redacted payload
- Error message
- Retry/reprocess button in development

Redact phone numbers, email addresses, tokens, recording URLs, and sensitive content from client-visible debugging where appropriate.

Before implementing detailed call normalization, use the actual webhook payload received from HighLevel. If no payload is available yet:
1. Build the generic receiver.
2. Deploy it.
3. Give me the exact webhook URL.
4. Tell me exactly how to trigger one test outbound call.
5. Ask me to complete that call.
6. Inspect the received payload.
7. Update the normalizer based on observed fields.
8. Save an anonymized fixture for automated tests.

Do not fabricate a HighLevel webhook schema.

### 5. Sales activity model

**Calls:** External ID, Contact ID, Direction, Start time, End time, Duration, Provider status, Answered status when supported, Voicemail status when supported, Disposition, Meaningful conversation flag, Appointment-result flag, Source payload ID.

**Contacts:** HighLevel contact ID, Business name, Contact name, Niche, Tags, Timezone, Last activity time.

**Opportunities:** HighLevel opportunity ID, Contact ID, Pipeline, Stage, Status, Monetary value, Monthly recurring value, Created time, Updated time.

**Appointments:** HighLevel appointment ID, Contact ID, Start time, Status, Show status, Outcome.

Meaningful conversation must not be inferred merely from duration until we define a defensible rule. Initially allow one-tap classification or an imported HighLevel disposition.

### 6. Revenue goal engine

Calculate: Monthly revenue goal, Current MRR, Remaining MRR, Clients needed based on average client value, Calls completed this week, Remaining weekly calls, Remaining workdays, Required daily call pace, Meetings booked, Meetings attended, Clients closed, Actual conversion rates once enough data exists.

Use plain-language outputs, e.g. "You need 3 additional clients at an average of $2,500 per month."

Do not present projections as guarantees.

### 7. Notifications

Implement iPhone-compatible web push notifications.

Ask for notification permission only after explaining the benefit and after the user taps an enable button.

Notification rules for v1:
1. Morning brief at the configured time.
2. Call block begins in 10 minutes.
3. No call is logged within 10 minutes after a call block starts.
4. User is three or fewer calls from completing the block.
5. No HighLevel call activity for 25 minutes during an active call block.
6. Call-block target completed.
7. Follow-up due.
8. Behind weekly pace.
9. End-of-day summary.
10. Weekly review.

Rules:
- Maximum one inactivity nudge every 45 minutes.
- Never send inactivity notifications outside an active block.
- Respect configured quiet hours.
- Store notification delivery attempts and outcomes.
- Deep-link notifications to the relevant screen.
- Allow each notification category to be disabled.

Use deterministic notification copy first, e.g. "You are at 7 of 10 calls. Complete the final 3 before switching tasks." or "No HighLevel call activity has been recorded for 25 minutes during your active block."

Do not write speculative emotional claims like "You are procrastinating because you fear rejection."

### 8. One-tap behavioral check-ins

When appropriate, ask one simple question: "What interrupted the block?"

Options: Anxiety, Rejection, Distracted, Low energy, Other work, Technical issue, Bad lead list, Needed a break, Completed activity elsewhere.

Allow optional notes, but never require typing.

Store: Trigger, Related call block, Selected response, Timestamp, Whether activity resumed within 10, 30, and 60 minutes.

### 9. Daily review

At the end of the day show: Calls completed, Target completion, Human answers when available, Meaningful conversations, Appointments, Follow-ups completed, Revenue changes, Call-block completion, Longest inactivity gap during active blocks, One observed factual pattern, At most one check-in question.

Example factual observation: "You completed 72% of your calls before noon." Not: "You were more motivated in the morning."

### 10. Weekly review

Show: Weekly target versus actual, Daily consistency, Appointments booked, Closed clients, New MRR, Performance by niche when enough data exists, Best call windows by answer or meeting rate, Follow-up completion, Call-block completion, Progress toward $10,000, One experiment for the next week.

Clearly label small samples, e.g. "Roofing had the highest answer rate, but this is based on only 14 calls."

### 11. Settings

Include: Revenue goal, Average client value, Daily and weekly call target, Workdays, Calling hours, Quiet hours, Morning brief time, Daily summary time, Notification categories, HighLevel connection, Export my data, Delete my data, Sign out.

## Database design

Create migrations for at least: profiles, goals, highlevel_connections, contacts, call_events, opportunities, appointments, work_blocks, behavioral_checkins, notification_preferences, push_subscriptions, notification_deliveries, interventions, raw_webhook_events, daily_metrics, weekly_metrics.

Every user-owned table must include a user ID and appropriate Row Level Security.

Create unique constraints for provider IDs and deduplication.

Use indexes for: User and event timestamp, External provider ID, Active work blocks, Due follow-ups, Unprocessed webhook events.

Include created and updated timestamps.

Write migrations rather than manually requiring dashboard-created tables.

## Design direction

The interface should feel like a high-end private executive dashboard, not a colorful habit tracker.

Use: Warm white or soft neutral background, Dark charcoal typography, Restrained gold or taupe accent, Large readable numbers, Generous spacing, Rounded cards used sparingly, Clear hierarchy, Subtle progress indicators, Minimal navigation.

Do not use: Childlike gamification, Confetti, Excessive gradients, Dense tables on the main screen, Generic stock illustrations, Long motivational paragraphs, More than one primary action per view.

Create a bottom navigation with: Today, Pipeline, Patterns, Review, Settings.

The Pipeline screen may summarize HighLevel data but must not attempt to replace the complete HighLevel CRM.

Meet WCAG AA contrast requirements and provide accessible labels.

## AI coaching layer

Do not implement the AI layer until: HighLevel ingestion works, Daily metrics work, Notifications work, Daily review works.

Create an interface for a future coaching provider.

When implemented, require structured JSON output validated with Zod.

The AI may: Summarize factual activity, Recommend one next action, Generate a concise morning brief, Suggest one weekly experiment, Identify correlations with sample sizes.

The AI may not: Invent metrics, Claim causality, Diagnose mental health, State emotional interpretations as facts, Send communications to leads, Autonomously change CRM data.

Every coaching request should receive a compact data packet, not unrestricted database access.

## Required API routes or server functions

Create secure equivalents for: Authentication callbacks, HighLevel webhook receiver, HighLevel connection test, HighLevel reconciliation, Webhook reprocessing, Dashboard metrics, Start call block, End call block, Behavioral check-in, Push subscription, Test push notification, Notification scheduler, Daily summary, Weekly summary, Data export, Account deletion.

Use rate limiting on public-facing and webhook endpoints.

Verify webhook authenticity if HighLevel supplies a supported signature mechanism for the configured integration. Document what is and is not verified.

## Scheduling

Implement a secure scheduled job mechanism for: Morning briefs, Call-block reminders, Active-block inactivity checks, Follow-up reminders, End-of-day summaries, Weekly reviews, HighLevel reconciliation.

Schedules must operate correctly in America/Los_Angeles, including daylight-saving changes.

Do not rely on a browser tab remaining open.

## Testing

**Unit tests:** Revenue goal calculations, Required daily call pace, Timezone boundaries, Notification cooldowns, Active-block inactivity logic, Event deduplication, Webhook normalization, Money calculations.

**Integration tests:** Webhook receipt to normalized call event, Duplicate webhook handling, Work-block progress updates after a call, Metrics recalculation, Push-subscription storage, RLS behavior.

**End-to-end tests:** Sign in, Complete onboarding, Start a call block, View updated progress from a test event, Complete a behavioral check-in, Change notification settings, View daily review.

Create anonymized fixture payloads from real observed HighLevel test data.

## Seed and demo mode

Provide a safe demo mode with fictional businesses and sales activity so the interface can be evaluated before HighLevel is connected.

Clearly label demo data.

Provide a reset-demo-data command.

Do not mix demo records with production records.

## Developer experience

Create: .env.example, README.md, SETUP.md, ARCHITECTURE.md, HIGHLEVEL_INTEGRATION.md, DEPLOYMENT.md, SECURITY.md, IMPLEMENTATION_PLAN.md.

The README should contain quick-start commands.

The setup guide should be written for a nontechnical owner and provide one action at a time.

Add scripts for: Development, Type checking, Linting, Unit tests, E2E tests, Database migration, Seed demo data, Build, Deployment validation.

Use clear error messages.

## Deployment milestone order

**Milestone 1: clickable private demo** - App shell, Authentication, Onboarding, Today screen, Call blocks, Demo data, PWA installation, Basic settings, Tests.

**Milestone 2: HighLevel observation** - Secure webhook endpoint, Raw event storage, Webhook inspector, One real test call, Actual payload analysis, Call-event normalization, Automatic dashboard update, Reconciliation skeleton.

**Milestone 3: notifications** - Web Push, Notification preferences, Scheduler, Deterministic nudges, Test notification, Deep links, Cooldowns.

**Milestone 4: reporting** - Daily metrics, Weekly metrics, Daily review, Weekly review, Revenue pace, Behavioral check-ins.

**Milestone 5: optional AI** - Structured coaching output, Morning brief, One recommended action, Weekly experiment, Clear fact-versus-hypothesis labeling.

Complete each milestone, run its tests, and update IMPLEMENTATION_PLAN.md before proceeding.

## Definition of done for v1

1. I can sign into Jessica OS from my iPhone.
2. I can add it to my home screen.
3. I can enable push notifications.
4. I can connect my HighLevel account securely.
5. A real outbound HighLevel call appears in Jessica OS automatically.
6. Duplicate webhooks do not create duplicate calls.
7. A call updates an active call block.
8. Today's dashboard accurately shows calls versus target.
9. I receive an inactivity notification only during an active call block.
10. I receive an end-of-day summary.
11. I can answer a behavioral check-in in two taps or fewer.
12. The app shows progress toward $10,000 MRR.
13. HighLevel and Jessica OS totals reconcile.
14. I can export and delete my data.
15. Production secrets are not exposed to the client.
16. Type checking, linting, tests, and production build pass.

## How to communicate with me

Assume I am the product owner, not a developer.

Do not ask broad questions such as "How would you like to proceed?"

Make sensible product decisions from this specification.

When you need me:
1. State why you are blocked.
2. Give me exactly one action.
3. Give exact click-by-click instructions.
4. Tell me what result to return to you.
5. Do not request that I paste secret keys into chat. Tell me how to enter them into a secure environment variable manager.
6. Continue immediately after I provide the result.

At the end of every milestone, report: What now works, What was tested, Any unresolved limitation, The single next action.

Start now by inspecting the repository and creating IMPLEMENTATION_PLAN.md.
