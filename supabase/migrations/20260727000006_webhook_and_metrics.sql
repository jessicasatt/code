-- Raw webhook storage (received before any normalization, per SPEC.md rule
-- "store raw webhook payloads before normalizing them") and the daily /
-- weekly metrics rollups.

create table public.raw_webhook_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'highlevel',
  received_at timestamptz not null default now(),
  event_type text not null default 'unknown',
  external_event_id text,
  dedupe_key text not null,
  raw_payload jsonb not null,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processed', 'error', 'ignored')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index raw_webhook_events_unprocessed_idx on public.raw_webhook_events (user_id, received_at) where processing_status = 'pending';
create index raw_webhook_events_external_id_idx on public.raw_webhook_events (external_event_id);

alter table public.call_events
  add constraint call_events_source_payload_fk
  foreign key (source_payload_id) references public.raw_webhook_events (id) on delete set null;

create table public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric_date date not null,
  calls_completed integer not null default 0,
  calls_target integer not null default 0,
  human_answers integer,
  meaningful_conversations integer not null default 0,
  appointments_booked integer not null default 0,
  follow_ups_completed integer not null default 0,
  revenue_change_cents bigint not null default 0,
  call_block_completion_pct numeric(5, 2),
  longest_inactivity_gap_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, metric_date)
);

create trigger set_daily_metrics_updated_at
  before update on public.daily_metrics
  for each row execute function public.set_updated_at();

create index daily_metrics_user_date_idx on public.daily_metrics (user_id, metric_date desc);

create table public.weekly_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  calls_target integer not null default 0,
  calls_actual integer not null default 0,
  appointments_booked integer not null default 0,
  clients_closed integer not null default 0,
  new_mrr_cents bigint not null default 0,
  follow_up_completion_pct numeric(5, 2),
  call_block_completion_pct numeric(5, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create trigger set_weekly_metrics_updated_at
  before update on public.weekly_metrics
  for each row execute function public.set_updated_at();

create index weekly_metrics_user_week_idx on public.weekly_metrics (user_id, week_start desc);
