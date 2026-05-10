-- =========================================================
-- v4: стабильная образовательная платформа / CRM
-- Запускать после основных SQL-файлов проекта.
-- Скрипт безопасен для повторного запуска: почти везде используется IF NOT EXISTS.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- Роли и профили ----------
alter table profiles add column if not exists role text default 'student';
alter table profiles add column if not exists display_name text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists telegram text;
alter table profiles add column if not exists updated_at timestamp with time zone default now();

alter table student_profiles add column if not exists active boolean default true;
alter table student_profiles add column if not exists status text default 'active';
alter table student_profiles add column if not exists class_level text;
alter table student_profiles add column if not exists phone text;
alter table student_profiles add column if not exists telegram text;
alter table student_profiles add column if not exists parent_contact text;
alter table student_profiles add column if not exists balance integer default 0;
alter table student_profiles add column if not exists updated_at timestamp with time zone default now();

-- ---------- Материалы, ДЗ, расписание ----------
alter table materials add column if not exists level text;
alter table materials add column if not exists tags text[] default '{}';
alter table materials add column if not exists updated_at timestamp with time zone default now();

alter table homework add column if not exists status text default 'assigned';
alter table homework add column if not exists grade_percent integer;
alter table homework add column if not exists checked_at timestamp with time zone;
alter table homework add column if not exists checked_by uuid references auth.users(id) on delete set null;
alter table homework add column if not exists updated_at timestamp with time zone default now();

alter table slots add column if not exists student_profile_id uuid references student_profiles(id) on delete set null;
alter table slots add column if not exists teacher_note text;
alter table slots add column if not exists google_event_id text;
alter table slots add column if not exists google_event_url text;
alter table slots add column if not exists updated_at timestamp with time zone default now();

-- ---------- Финансы ----------
alter table lesson_types add column if not exists sort_order integer default 100;
alter table lesson_types add column if not exists updated_at timestamp with time zone default now();

alter table subscriptions add column if not exists is_active boolean default true;
alter table subscriptions add column if not exists updated_at timestamp with time zone default now();

alter table student_packages add column if not exists status text default 'active';
alter table student_packages add column if not exists notes text;
alter table student_packages add column if not exists updated_at timestamp with time zone default now();

alter table payments add column if not exists notes text;
alter table payments add column if not exists updated_at timestamp with time zone default now();

-- ---------- Журнал занятий ----------
create table if not exists lesson_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references student_profiles(id) on delete set null,
  slot_id uuid references slots(id) on delete set null,
  lesson_type_id uuid references lesson_types(id) on delete set null,
  topic_title text,
  summary text,
  homework_note text,
  comment text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table lesson_logs enable row level security;
drop policy if exists "Admin manage lesson logs v4" on lesson_logs;
create policy "Admin manage lesson logs v4" on lesson_logs for all using (is_admin()) with check (is_admin());
drop policy if exists "Students read own lesson logs v4" on lesson_logs;
create policy "Students read own lesson logs v4" on lesson_logs for select using (student_id is not null and is_student_owner(student_id));

-- ---------- Очередь уведомлений и Google sync ----------
create table if not exists notification_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  channel text default 'email',
  status text default 'pending',
  payload jsonb default '{}'::jsonb,
  error text,
  created_at timestamp with time zone default now(),
  processed_at timestamp with time zone
);

alter table notification_events enable row level security;
drop policy if exists "Admin manage notification events v4" on notification_events;
create policy "Admin manage notification events v4" on notification_events for all using (is_admin()) with check (is_admin());

create table if not exists google_sync_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamp with time zone default now(),
  processed_at timestamp with time zone
);

alter table google_sync_events enable row level security;
drop policy if exists "Admin manage google sync events v4" on google_sync_events;
create policy "Admin manage google sync events v4" on google_sync_events for all using (is_admin()) with check (is_admin());

-- ---------- История действий ----------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

alter table activity_log enable row level security;
drop policy if exists "Admin read activity v4" on activity_log;
create policy "Admin read activity v4" on activity_log for select using (is_admin());
drop policy if exists "Admin insert activity v4" on activity_log;
create policy "Admin insert activity v4" on activity_log for insert with check (is_admin());

-- ---------- Индексы для скорости ----------
create index if not exists idx_slots_date_status on slots(date, status);
create index if not exists idx_slots_student_profile on slots(student_profile_id);
create index if not exists idx_homework_student_deadline on homework(student_id, deadline);
create index if not exists idx_payments_student_status on payments(student_id, status);
create index if not exists idx_student_packages_student_status on student_packages(student_id, status);
create index if not exists idx_google_sync_status_created on google_sync_events(status, created_at);
create index if not exists idx_notification_status_created on notification_events(status, created_at);

-- ---------- Базовые типы занятий, чтобы сайт не был пустым ----------
insert into lesson_types (title, subject, duration, price, currency, format, description, is_active, sort_order)
values
  ('Индивидуальное занятие · 60 минут', 'Математика', 60, 2000, 'RUB', 'online', 'Стандартное занятие онлайн', true, 10),
  ('Индивидуальное занятие · 90 минут', 'Математика', 90, 3000, 'RUB', 'online', 'Углублённое занятие онлайн', true, 20)
on conflict do nothing;

insert into subscriptions (title, lessons_count, discount_percent, valid_days, is_active)
values
  ('Абонемент на 4 занятия', 4, 3, 30, true),
  ('Абонемент на 8 занятий', 8, 5, 45, true),
  ('Абонемент на 12 занятий', 12, 10, 60, true)
on conflict do nothing;
