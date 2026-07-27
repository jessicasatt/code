-- Work blocks (call sessions) and the call events / behavioral check-ins
-- that occur inside them.

create table public.work_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  planned_start timestamptz not null,
  planned_end timestamptz not null,
  actual_start timestamptz,
  actual_end timestamptz,
  call_target integer not null default 0 check (call_target >= 0),
  calls_completed integer not null default 0 check (calls_completed >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed', 'cancelled')),
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_work_blocks_updated_at
  before update on public.work_blocks
  for each row execute function public.set_updated_at();

create index work_blocks_user_planned_start_idx on public.work_blocks (user_id, planned_start desc);

-- Partial index: at most one active block per user in practice, but this
-- keeps "find the active block" lookups (used by the inactivity checker)
-- fast without scanning completed/cancelled history.
create unique index work_blocks_active_per_user_idx on public.work_blocks (user_id) where status = 'active';

create table public.call_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  external_id text not null,
  contact_id uuid references public.contacts (id) on delete set null,
  work_block_id uuid references public.work_blocks (id) on delete set null,
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  start_time timestamptz not null,
  end_time timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  provider_status text,
  answered_status text not null default 'unknown' check (answered_status in ('answered', 'no_answer', 'voicemail', 'unknown')),
  voicemail_status boolean,
  disposition text,
  meaningful_conversation boolean,
  appointment_result boolean,
  source_payload_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index call_events_user_start_time_idx on public.call_events (user_id, start_time desc);
create index call_events_work_block_idx on public.call_events (work_block_id);

create table public.behavioral_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  work_block_id uuid references public.work_blocks (id) on delete set null,
  trigger text not null,
  reason text not null check (
    reason in (
      'anxiety', 'rejection', 'distracted', 'low_energy', 'other_work',
      'technical_issue', 'bad_lead_list', 'needed_a_break', 'completed_activity_elsewhere'
    )
  ),
  note text,
  created_at timestamptz not null default now(),
  resumed_within_10_min boolean,
  resumed_within_30_min boolean,
  resumed_within_60_min boolean
);

create index behavioral_checkins_user_created_idx on public.behavioral_checkins (user_id, created_at desc);
