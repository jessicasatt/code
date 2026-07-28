-- Proactive coaching settings: additive, separate from profiles/goals.
-- profiles keeps owning "workdays" and "calling hours" (unchanged); this
-- table adds only the new fields Phase 2 of the proactive coaching work
-- introduces, plus the pause/vacation controls.

create table public.coaching_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'America/Los_Angeles',
  desired_first_call_time time not null default '09:00',
  default_block_size integer not null default 10 check (default_block_size > 0),
  inactivity_threshold_minutes integer not null default 25 check (inactivity_threshold_minutes > 0),
  behind_pace_tolerance_pct integer not null default 20 check (behind_pace_tolerance_pct between 0 and 100),
  notification_cooldown_minutes integer not null default 45 check (notification_cooldown_minutes > 0),
  max_proactive_notifications_per_day integer not null default 6 check (max_proactive_notifications_per_day >= 0),
  coaching_intensity text not null default 'standard' check (coaching_intensity in ('gentle', 'standard', 'direct')),
  coaching_paused_until timestamptz,
  vacation_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_coaching_settings_updated_at
  before update on public.coaching_settings
  for each row execute function public.set_updated_at();

alter table public.coaching_settings enable row level security;

create policy "coaching_settings_owner_all" on public.coaching_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
