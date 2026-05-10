-- =========================================================
-- WIZARD / CASES / EXAMPLES / FAQ UPDATE
-- Run after previous SQL files.
-- =========================================================

create table if not exists student_cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text,
  grade text,
  before_text text,
  process_text text,
  result_text text,
  proof_url text,
  image_url text,
  is_published boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table student_cases enable row level security;

drop policy if exists "Public read published student cases" on student_cases;
drop policy if exists "Admin manage student cases" on student_cases;

create policy "Public read published student cases"
on student_cases for select
using (is_published = true);

create policy "Admin manage student cases"
on student_cases for all
using (is_admin())
with check (is_admin());

create table if not exists lesson_examples (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text,
  type text,
  description text,
  file_url text,
  is_published boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table lesson_examples enable row level security;

drop policy if exists "Public read published lesson examples" on lesson_examples;
drop policy if exists "Admin manage lesson examples" on lesson_examples;

create policy "Public read published lesson examples"
on lesson_examples for select
using (is_published = true);

create policy "Admin manage lesson examples"
on lesson_examples for all
using (is_admin())
with check (is_admin());

-- Make no-slot diagnostic requests explicit
alter table booking_requests add column if not exists goal text;
alter table booking_requests add column if not exists is_diagnostic boolean not null default true;
alter table booking_requests alter column slot_id drop not null;
