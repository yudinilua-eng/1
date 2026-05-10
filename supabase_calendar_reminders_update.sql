-- =========================================================
-- CALENDAR SLOT EDITOR + HOMEWORK REMINDERS UPDATE
-- Run after previous SQL files.
-- =========================================================

alter table student_profiles add column if not exists telegram text;

-- Lesson request reminders and homework reminders use notification_events.
create table if not exists notification_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  channel text not null default 'email',
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  error text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table notification_events enable row level security;

drop policy if exists "Admin manage notification events" on notification_events;
drop policy if exists "Students create own reminder events" on notification_events;

create policy "Admin manage notification events"
on notification_events
for all
using (is_admin())
with check (is_admin());

create policy "Students create own reminder events"
on notification_events
for insert
with check (auth.uid() is not null);

insert into integration_settings (provider, key, value, is_public)
values
  ('telegram', 'enabled', 'false', false),
  ('telegram', 'bot_token_configured_on_server', 'false', false),
  ('email', 'homework_reminders_enabled', 'true', false)
on conflict (provider, key) do nothing;
