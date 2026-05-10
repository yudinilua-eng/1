-- =========================================================
-- GOOGLE SYNC V5: поля статусов, попыток и результатов
-- Выполнить после supabase_platform_optimization_v4.sql
-- =========================================================

create table if not exists google_sync_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  attempts integer not null default 0,
  error text,
  last_attempt_at timestamp with time zone,
  processed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table google_sync_events add column if not exists result jsonb;
alter table google_sync_events add column if not exists attempts integer not null default 0;
alter table google_sync_events add column if not exists last_attempt_at timestamp with time zone;
alter table google_sync_events add column if not exists processed_at timestamp with time zone;
alter table google_sync_events add column if not exists error text;
alter table google_sync_events add column if not exists created_at timestamp with time zone default now();

alter table google_sync_events enable row level security;

drop policy if exists "Admin manage google sync events" on google_sync_events;
create policy "Admin manage google sync events"
on google_sync_events
for all
using (is_admin())
with check (is_admin());

create index if not exists idx_google_sync_events_status_created_at
on google_sync_events(status, created_at);

alter table slots add column if not exists google_event_id text;
alter table slots add column if not exists google_event_url text;
alter table slots add column if not exists google_synced_at timestamp with time zone;

insert into integration_settings (provider, key, value, is_public)
values
  ('google', 'calendar_sync_enabled', 'true', false),
  ('google', 'sheets_sync_enabled', 'true', false),
  ('google', 'drive_sync_enabled', 'true', false),
  ('google', 'sync_function', 'process-google-sync', false)
on conflict (provider, key) do update set value = excluded.value;
