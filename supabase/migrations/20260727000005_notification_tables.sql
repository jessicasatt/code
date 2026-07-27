-- Notification preferences, Web Push subscriptions, delivery log, and a
-- generic log of system "interventions" (e.g. a nudge triggered by a
-- behavioral check-in).

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (
    category in (
      'morning_brief', 'block_starting_soon', 'no_calls_logged_yet', 'few_calls_remaining',
      'inactivity', 'block_target_completed', 'follow_up_due', 'behind_weekly_pace',
      'end_of_day_summary', 'weekly_review'
    )
  ),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);

create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  title text not null,
  body text not null,
  deep_link text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index notification_deliveries_user_created_idx on public.notification_deliveries (user_id, created_at desc);

create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  behavioral_checkin_id uuid references public.behavioral_checkins (id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index interventions_user_created_idx on public.interventions (user_id, created_at desc);
