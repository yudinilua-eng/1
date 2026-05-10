-- v8: fix student account RLS, add safe RPCs, and enable realtime refresh.
-- Run this AFTER previous v6/v7 SQL files in Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table if exists public.student_profiles
  add column if not exists telegram text,
  add column if not exists yandex_folder_url text,
  add column if not exists notes text;

create table if not exists public.student_credentials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  login_name text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_credentials_student_id on public.student_credentials(student_id);
create index if not exists idx_student_credentials_login_name on public.student_credentials(login_name);

create or replace function public.touch_student_credentials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_student_credentials_updated_at on public.student_credentials;
create trigger trg_touch_student_credentials_updated_at
before update on public.student_credentials
for each row execute function public.touch_student_credentials_updated_at();

-- Helper: the teacher/admin check used by SECURITY DEFINER RPCs.
create or replace function public.is_platform_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, '') in ('admin', 'teacher')
  );
$$;

-- Create student + login in one transaction. Bypasses table RLS safely, but only for admin/teacher users.
create or replace function public.teacher_create_student_access(
  p_name text,
  p_login_name text,
  p_password_hash text,
  p_email text default null,
  p_subject text default null,
  p_telegram text default null,
  p_yandex_folder_url text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_login text;
begin
  if not public.is_platform_teacher() then
    raise exception 'Only teacher/admin can create student access';
  end if;

  v_login := lower(regexp_replace(trim(p_login_name), '\s+', '_', 'g'));
  if v_login is null or length(v_login) < 3 then
    raise exception 'Login must contain at least 3 characters';
  end if;
  if p_password_hash is null or length(p_password_hash) < 32 then
    raise exception 'Password hash is missing';
  end if;

  insert into public.student_profiles(name, email, subject, telegram, yandex_folder_url, notes)
  values (
    nullif(trim(p_name), ''),
    coalesce(nullif(trim(p_email), ''), v_login || '@student.local'),
    nullif(trim(p_subject), ''),
    nullif(trim(p_telegram), ''),
    nullif(trim(p_yandex_folder_url), ''),
    nullif(trim(p_notes), '')
  )
  returning id into v_student_id;

  insert into public.student_credentials(student_id, login_name, password_hash, is_active)
  values (v_student_id, v_login, p_password_hash, true);

  return v_student_id;
exception
  when unique_violation then
    raise exception 'Такой логин уже занят. Выберите другой.';
end;
$$;

-- List credentials for the teacher cabinet without exposing password_hash.
create or replace function public.list_student_credentials_for_teacher(p_student_ids uuid[])
returns table(student_id uuid, login_name text, is_active boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_teacher() then
    raise exception 'Only teacher/admin can list student credentials';
  end if;

  return query
  select c.student_id, c.login_name, c.is_active, c.updated_at
  from public.student_credentials c
  where c.student_id = any(p_student_ids);
end;
$$;

create or replace function public.teacher_reset_student_password(p_student_id uuid, p_password_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_teacher() then
    raise exception 'Only teacher/admin can reset student passwords';
  end if;

  update public.student_credentials
  set password_hash = p_password_hash,
      is_active = true,
      updated_at = now()
  where student_id = p_student_id;

  if not found then
    raise exception 'Student login was not found';
  end if;
end;
$$;

create or replace function public.teacher_delete_student_access(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_teacher() then
    raise exception 'Only teacher/admin can delete students';
  end if;

  delete from public.student_credentials where student_id = p_student_id;
  delete from public.student_profiles where id = p_student_id;
end;
$$;

-- Student login check. It returns only student_id and never exposes password_hash.
create or replace function public.student_login_by_password(p_login_name text, p_password_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  select c.student_id into v_student_id
  from public.student_credentials c
  where c.login_name = lower(regexp_replace(trim(p_login_name), '\s+', '_', 'g'))
    and c.password_hash = p_password_hash
    and c.is_active = true
  limit 1;

  if v_student_id is null then
    raise exception 'Неверное имя или пароль.';
  end if;

  return v_student_id;
end;
$$;

grant execute on function public.teacher_create_student_access(text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.list_student_credentials_for_teacher(uuid[]) to authenticated;
grant execute on function public.teacher_reset_student_password(uuid,text) to authenticated;
grant execute on function public.teacher_delete_student_access(uuid) to authenticated;
grant execute on function public.student_login_by_password(text,text) to anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.student_profiles to anon, authenticated;

grant select on public.student_credentials to authenticated;

-- Keep RLS enabled, but allow teacher/authenticated fallback reads. Passwords are primarily handled by RPC above.
alter table public.student_credentials enable row level security;

drop policy if exists "student_credentials_teacher_select" on public.student_credentials;
create policy "student_credentials_teacher_select"
on public.student_credentials
for select
to authenticated
using (public.is_platform_teacher());

drop policy if exists "student_credentials_teacher_insert" on public.student_credentials;
create policy "student_credentials_teacher_insert"
on public.student_credentials
for insert
to authenticated
with check (public.is_platform_teacher());

drop policy if exists "student_credentials_teacher_update" on public.student_credentials;
create policy "student_credentials_teacher_update"
on public.student_credentials
for update
to authenticated
using (public.is_platform_teacher())
with check (public.is_platform_teacher());

drop policy if exists "student_credentials_teacher_delete" on public.student_credentials;
create policy "student_credentials_teacher_delete"
on public.student_credentials
for delete
to authenticated
using (public.is_platform_teacher());

-- Realtime: allow the site to update visible sections immediately when data changes.
do $$
begin
  begin alter publication supabase_realtime add table public.student_profiles; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.student_credentials; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.materials; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.homework; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.slots; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.payments; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.reviews; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.student_cases; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.lesson_examples; exception when duplicate_object then null; when undefined_object then null; end;
end $$;
