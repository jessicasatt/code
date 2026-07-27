-- Row Level Security. Every user-owned table is locked to auth.uid() =
-- user_id for all operations. This is a single-user product today, but RLS
-- is applied as if it weren't — no shortcuts.

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles', 'goals', 'highlevel_connections',
      'contacts', 'opportunities', 'appointments', 'follow_ups',
      'work_blocks', 'call_events', 'behavioral_checkins',
      'notification_preferences', 'push_subscriptions', 'notification_deliveries', 'interventions',
      'raw_webhook_events', 'daily_metrics', 'weekly_metrics'
    ])
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- profiles uses user_id as its primary key column directly.
create policy "profiles_owner_all" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'goals', 'highlevel_connections',
      'contacts', 'opportunities', 'appointments', 'follow_ups',
      'work_blocks', 'call_events', 'behavioral_checkins',
      'notification_preferences', 'push_subscriptions', 'notification_deliveries', 'interventions',
      'raw_webhook_events', 'daily_metrics', 'weekly_metrics'
    ])
  loop
    execute format(
      'create policy "%s_owner_all" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t, t
    );
  end loop;
end $$;
