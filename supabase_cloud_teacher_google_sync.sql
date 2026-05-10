-- =========================================================
-- CLOUD TEACHER SECTIONS + GOOGLE SYNC QUEUE
-- Run after previous SQL files.
-- =========================================================

create table if not exists google_sync_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  error text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table google_sync_events enable row level security;

drop policy if exists "Admin manage google sync events" on google_sync_events;
create policy "Admin manage google sync events"
on google_sync_events
for all
using (is_admin())
with check (is_admin());

alter table materials add column if not exists url text;
alter table student_profiles add column if not exists telegram text;
alter table homework add column if not exists grade_percent integer check (grade_percent between 0 and 100);
alter table homework add column if not exists checked_at timestamp with time zone;
alter table homework add column if not exists checked_by uuid references auth.users(id) on delete set null;

insert into integration_settings (provider, key, value, is_public)
values
  ('google', 'calendar_sync_enabled', 'false', false),
  ('google', 'sheets_sync_enabled', 'false', false),
  ('google', 'drive_sync_enabled', 'false', false),
  ('google', 'edge_function_required', 'true', false)
on conflict (provider, key) do nothing;
