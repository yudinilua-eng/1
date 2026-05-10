-- Student login by teacher-created username/password for v7
-- Run in Supabase SQL Editor after v6 SQL.

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

-- Keep updated_at fresh.
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

-- For this browser-only version, anon needs limited read/write access so student login and teacher UI work.
-- This is acceptable for a personal MVP, but for a public paid platform it is better to move password checks to a Supabase Edge Function.
alter table public.student_credentials disable row level security;

grant select, insert, update, delete on public.student_credentials to anon, authenticated;
grant usage on schema public to anon, authenticated;
