-- Local mirror of HighLevel CRM data. HighLevel remains the source of
-- truth; these tables exist so Jessica OS can compute metrics without
-- calling the HighLevel API on every page load.

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  highlevel_contact_id text not null,
  business_name text,
  contact_name text,
  niche text,
  tags text[] not null default '{}',
  timezone text,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, highlevel_contact_id)
);

create trigger set_contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create index contacts_user_last_activity_idx on public.contacts (user_id, last_activity_at desc);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  highlevel_opportunity_id text not null,
  contact_id uuid references public.contacts (id) on delete set null,
  pipeline text,
  stage text,
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'abandoned')),
  monetary_value_cents bigint not null default 0 check (monetary_value_cents >= 0),
  monthly_recurring_value_cents bigint not null default 0 check (monthly_recurring_value_cents >= 0),
  created_at_source timestamptz,
  updated_at_source timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, highlevel_opportunity_id)
);

create trigger set_opportunities_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

create index opportunities_user_status_idx on public.opportunities (user_id, status);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  highlevel_appointment_id text not null,
  contact_id uuid references public.contacts (id) on delete set null,
  start_time timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'cancelled', 'completed')),
  show_status text not null default 'unknown' check (show_status in ('unknown', 'showed', 'no_show')),
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, highlevel_appointment_id)
);

create trigger set_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create index appointments_user_start_time_idx on public.appointments (user_id, start_time);

-- Not one of HighLevel's own object types, but needed to surface "Follow-ups
-- due" on the Today/Daily/Weekly screens per SPEC.md.
create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  due_at timestamptz not null,
  status text not null default 'due' check (status in ('due', 'completed', 'snoozed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_follow_ups_updated_at
  before update on public.follow_ups
  for each row execute function public.set_updated_at();

create index follow_ups_due_idx on public.follow_ups (user_id, due_at) where status = 'due';
