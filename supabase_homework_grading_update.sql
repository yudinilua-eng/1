-- =========================================================
-- HOMEWORK GRADING + TEACHER MENU UPDATE
-- Run after previous SQL files.
-- =========================================================

alter table homework add column if not exists grade_percent integer check (grade_percent between 0 and 100);
alter table homework add column if not exists checked_at timestamp with time zone;
alter table homework add column if not exists checked_by uuid references auth.users(id) on delete set null;

-- Ensure notification_events exists for homework_checked email events.
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
