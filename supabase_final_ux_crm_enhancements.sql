-- =========================================================
-- FINAL UX / CRM ENHANCEMENTS SQL
-- Страница "Сегодня", настройки сайта, подтверждение записи,
-- календарный workflow, авто-списание, родительские роли.
--
-- Выполнять после предыдущих SQL:
-- full_supabase_setup_with_prices_FIXED_v2.sql
-- supabase_enhancements_storage_journal.sql
-- supabase_super_enhancements.sql
-- =========================================================

-- 1. Site settings editable from teacher cabinet
create table if not exists site_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text,
  is_public boolean default true,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

alter table site_settings enable row level security;

drop policy if exists "Public read public site settings" on site_settings;
drop policy if exists "Admin manage site settings" on site_settings;

create policy "Public read public site settings"
on site_settings for select
using (is_public = true);

create policy "Admin manage site settings"
on site_settings for all
using (is_admin())
with check (is_admin());

-- 2. More slot workflow columns
alter table slots add column if not exists confirmed_at timestamp with time zone;
alter table slots add column if not exists completed_at timestamp with time zone;
alter table slots add column if not exists cancelled_at timestamp with time zone;
alter table slots add column if not exists rescheduled_from uuid references slots(id) on delete set null;

-- 3. Trigger-like helper: timestamp status changes via function is not required for HTML,
-- but columns are available for future Edge Functions.

-- 4. Activity log and booking requests if not already created
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
on activity_log for select
using (is_admin());

create policy "Logged users create activity log"
on activity_log for insert
with check (auth.uid() is not null);

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
on booking_requests for insert
with check (true);

create policy "Admin manage booking requests"
on booking_requests for all
using (is_admin())
with check (is_admin());

create policy "Students read own booking requests"
on booking_requests for select
using (student_profile_id is not null and is_student_owner(student_profile_id));

-- 5. Parent tables if not already created
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

-- 6. Defaults for site settings
insert into site_settings (key, value, is_public)
values
  ('teacher_name', 'Илья Юдин', true),
  ('hero_title', 'Математика, физика и химия с Ильёй Юдиным', true),
  ('hero_text', 'Индивидуальные онлайн-занятия, расписание, материалы и личный кабинет ученика.', true),
  ('phone', '+7 999 000-00-00', true),
  ('email', 'ilya.yudin@example.com', true),
  ('telegram', '', true),
  ('whatsapp', '', true),
  ('payment_url', '', true)
on conflict (key) do nothing;
