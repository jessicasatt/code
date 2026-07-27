-- Core per-user configuration: profile, revenue goal, HighLevel connection.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  morning_brief_time time not null default '07:30',
  end_of_day_summary_time time not null default '18:00',
  calling_hours_start time not null default '09:00',
  calling_hours_end time not null default '17:00',
  quiet_hours_start time not null default '20:00',
  quiet_hours_end time not null default '07:00',
  workdays text[] not null default array['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  monthly_revenue_goal_cents bigint not null default 1000000 check (monthly_revenue_goal_cents >= 0),
  current_mrr_cents bigint not null default 0 check (current_mrr_cents >= 0),
  average_client_value_cents bigint not null default 0 check (average_client_value_cents >= 0),
  daily_call_target integer not null default 0 check (daily_call_target >= 0),
  weekly_call_target integer not null default 0 check (weekly_call_target >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create trigger set_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

create table public.highlevel_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'disconnected' check (mode in ('private_integration', 'oauth', 'disconnected')),
  location_id text,
  connected boolean not null default false,
  last_verified_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create trigger set_highlevel_connections_updated_at
  before update on public.highlevel_connections
  for each row execute function public.set_updated_at();
