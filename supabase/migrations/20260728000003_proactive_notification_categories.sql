-- Adds the four notification categories the intervention engine can send
-- (PROACTIVE_COACHING_AUDIT.md Phase 3.5): late_start, behind_pace,
-- daily_target_complete, data_stale. Existing rows are untouched — this
-- only widens what's allowed going forward.
--
-- Looks up the existing check constraint on notification_preferences.category
-- by inspecting the catalog rather than assuming its auto-generated name,
-- so this doesn't fail if Postgres named it something unexpected.

do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
  where rel.relname = 'notification_preferences'
    and con.contype = 'c'
    and att.attname = 'category';

  if existing_constraint is not null then
    execute format('alter table public.notification_preferences drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.notification_preferences add constraint notification_preferences_category_check check (
  category in (
    'morning_brief', 'block_starting_soon', 'no_calls_logged_yet', 'few_calls_remaining',
    'inactivity', 'block_target_completed', 'follow_up_due', 'behind_weekly_pace',
    'end_of_day_summary', 'weekly_review',
    'late_start', 'behind_pace', 'daily_target_complete', 'data_stale'
  )
);
