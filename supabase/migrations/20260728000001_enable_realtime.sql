-- Enables Supabase Realtime (postgres_changes) for the two tables the
-- Execute screen needs to react to live: work_blocks (active block
-- progress) and call_events (individual call activity). RLS already scopes
-- both to auth.uid() = user_id, so Realtime only ever streams a user's own
-- rows to their own client.
alter publication supabase_realtime add table public.work_blocks;
alter publication supabase_realtime add table public.call_events;
