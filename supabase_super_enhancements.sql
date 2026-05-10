-- =========================================================
-- SUPER ENHANCEMENTS SQL
-- Подтверждение записи, календарный workflow, уведомления,
-- родительский доступ, аналитика, библиотека, тесты, история действий.
--
-- Выполнять после:
-- 1) full_supabase_setup_with_prices_FIXED_v2.sql
-- 2) supabase_enhancements_storage_journal.sql
-- =========================================================

-- ---------------------------------------------------------
-- 1. Статусы слотов
-- open / pending / booked / confirmed / completed / cancelled / rescheduled / closed
-- ---------------------------------------------------------

alter table slots add column if not exists status text not null default 'closed';
alter table slots add column if not exists confirmed_at timestamp with time zone;
alter table slots add column if not exists completed_at timestamp with time zone;
alter table slots add column if not exists cancelled_at timestamp with time zone;
alter table slots add column if not exists rescheduled_from uuid references slots(id) on delete set null;


-- ---------------------------------------------------------
-- 2. Заявки на запись с подтверждением преподавателя
-- ---------------------------------------------------------

create table if not exists booking_requests (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid references slots(id) on delete cascade,
  student_profile_id uuid references student_profiles(id) on delete set null,
  name text,
  email text,
  contact text,
  message text,
  status text not null default 'pending',
  teacher_comment text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table booking_requests enable row level security;

drop policy if exists "Anyone can create booking requests" on booking_requests;
drop policy if exists "Admin manage booking requests" on booking_requests;
drop policy if exists "Students read own booking requests" on booking_requests;

create policy "Anyone can create booking requests"
on booking_requests
for insert
with check (true);

create policy "Admin manage booking requests"
on booking_requests
for all
using (is_admin())
with check (is_admin());

create policy "Students read own booking requests"
on booking_requests
for select
using (
  student_profile_id is not null
  and is_student_owner(student_profile_id)
);


-- ---------------------------------------------------------
-- 3. Notification events
-- Edge Function/cron can read pending events and send email/Google updates.
-- ---------------------------------------------------------

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

create policy "Admin manage notification events"
on notification_events
for all
using (is_admin())
with check (is_admin());


-- ---------------------------------------------------------
-- 4. Activity log
-- ---------------------------------------------------------

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

drop policy if exists "Admin read activity log" on activity_log;
drop policy if exists "Logged users create activity log" on activity_log;

create policy "Admin read activity log"
on activity_log
for select
using (is_admin());

create policy "Logged users create activity log"
on activity_log
for insert
with check (auth.uid() is not null);


-- ---------------------------------------------------------
-- 5. Parent access
-- В текущем HTML родительский кабинет использует данные ученика.
-- Таблица нужна для будущего отдельного parent role/login.
-- ---------------------------------------------------------

create table if not exists parent_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text unique not null,
  phone text,
  created_at timestamp with time zone default now()
);

create table if not exists parent_students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parent_profiles(id) on delete cascade,
  student_id uuid references student_profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(parent_id, student_id)
);

alter table parent_profiles enable row level security;
alter table parent_students enable row level security;

create or replace function is_parent_owner(parent_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from parent_profiles pp
    where pp.id = parent_profile_id
    and (pp.auth_user_id = auth.uid() or lower(pp.email) = lower(current_user_email()))
  );
$$;

create or replace function parent_can_read_student(student_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from parent_students ps
    join parent_profiles pp on pp.id = ps.parent_id
    where ps.student_id = student_profile_id
    and (pp.auth_user_id = auth.uid() or lower(pp.email) = lower(current_user_email()))
  );
$$;

drop policy if exists "Admin manage parent profiles" on parent_profiles;
drop policy if exists "Parents read own profile" on parent_profiles;
drop policy if exists "Admin manage parent students" on parent_students;
drop policy if exists "Parents read own links" on parent_students;

create policy "Admin manage parent profiles"
on parent_profiles for all
using (is_admin())
with check (is_admin());

create policy "Parents read own profile"
on parent_profiles for select
using (is_parent_owner(id));

create policy "Admin manage parent students"
on parent_students for all
using (is_admin())
with check (is_admin());

create policy "Parents read own links"
on parent_students for select
using (is_parent_owner(parent_id));


-- ---------------------------------------------------------
-- 6. Quizzes
-- ---------------------------------------------------------

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references topics(id) on delete set null,
  student_id uuid references student_profiles(id) on delete cascade,
  title text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamp with time zone default now()
);

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text,
  explanation text,
  created_at timestamp with time zone default now()
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade,
  student_id uuid references student_profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  max_score integer not null default 0,
  created_at timestamp with time zone default now()
);

alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_attempts enable row level security;

drop policy if exists "Admin manage quizzes" on quizzes;
drop policy if exists "Students read assigned quizzes" on quizzes;
drop policy if exists "Admin manage quiz questions" on quiz_questions;
drop policy if exists "Students read quiz questions" on quiz_questions;
drop policy if exists "Admin manage quiz attempts" on quiz_attempts;
drop policy if exists "Students manage own quiz attempts" on quiz_attempts;

create policy "Admin manage quizzes"
on quizzes for all
using (is_admin())
with check (is_admin());

create policy "Students read assigned quizzes"
on quizzes for select
using (
  is_active = true
  and auth.uid() is not null
  and (
    student_id is null
    or is_student_owner(student_id)
    or parent_can_read_student(student_id)
  )
);

create policy "Admin manage quiz questions"
on quiz_questions for all
using (is_admin())
with check (is_admin());

create policy "Students read quiz questions"
on quiz_questions for select
using (
  exists (
    select 1 from quizzes q
    where q.id = quiz_questions.quiz_id
    and q.is_active = true
    and (
      q.student_id is null
      or is_student_owner(q.student_id)
      or parent_can_read_student(q.student_id)
    )
  )
);

create policy "Admin manage quiz attempts"
on quiz_attempts for all
using (is_admin())
with check (is_admin());

create policy "Students manage own quiz attempts"
on quiz_attempts for all
using (is_student_owner(student_id))
with check (is_student_owner(student_id));


-- ---------------------------------------------------------
-- 7. Parent read policies for existing tables
-- ---------------------------------------------------------

drop policy if exists "Parents read child homework" on homework;
create policy "Parents read child homework"
on homework for select
using (parent_can_read_student(student_id));

drop policy if exists "Parents read child packages" on student_packages;
create policy "Parents read child packages"
on student_packages for select
using (parent_can_read_student(student_id));

drop policy if exists "Parents read child payments" on payments;
create policy "Parents read child payments"
on payments for select
using (student_id is not null and parent_can_read_student(student_id));

drop policy if exists "Parents read child lesson logs" on lesson_logs;
create policy "Parents read child lesson logs"
on lesson_logs for select
using (parent_can_read_student(student_id));


-- ---------------------------------------------------------
-- 8. Google / email automation placeholders
-- Actual sending/syncing must be done by Supabase Edge Functions.
-- Store only public/non-secret config here.
-- ---------------------------------------------------------

insert into integration_settings (provider, key, value, is_public)
values
  ('google_calendar', 'enabled', 'false', false),
  ('email', 'enabled', 'false', false),
  ('google_sheets', 'enabled', 'false', false)
on conflict (provider, key) do nothing;


-- ---------------------------------------------------------
-- 9. Helpful views
-- ---------------------------------------------------------

create or replace view admin_booking_requests_view as
select
  br.id,
  br.status,
  br.name,
  br.email,
  br.contact,
  br.message,
  s.date,
  s.time,
  s.duration,
  lt.title as lesson_type_title,
  sp.name as student_profile_name,
  sp.email as student_profile_email,
  br.created_at
from booking_requests br
left join slots s on s.id = br.slot_id
left join lesson_types lt on lt.id = s.lesson_type_id
left join student_profiles sp on sp.id = br.student_profile_id;

create or replace view analytics_month_view as
select
  (select coalesce(sum(amount), 0) from payments where status = 'paid' and created_at >= date_trunc('month', now())) as revenue_month,
  (select count(*) from slots where status = 'completed' and created_at >= date_trunc('month', now())) as completed_lessons_month,
  (select count(*) from student_profiles where active = true) as active_students,
  (select count(*) from homework where is_done = false) as pending_homework;
