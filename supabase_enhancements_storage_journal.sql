-- =========================================================
-- ENHANCEMENTS SQL
-- Supabase Storage для файлов + журнал занятий + расширенные статусы.
-- Запускать после full_supabase_setup_with_prices_FIXED_v2.sql
-- =========================================================

-- 1. Storage bucket for materials/homework/answers
insert into storage.buckets (id, name, public)
values ('lesson-files', 'lesson-files', true)
on conflict (id) do update set public = true;

-- Public read for uploaded files
drop policy if exists "Public read lesson files" on storage.objects;
create policy "Public read lesson files"
on storage.objects
for select
using (bucket_id = 'lesson-files');

-- Admin can upload/update/delete lesson files
drop policy if exists "Admin manage lesson files" on storage.objects;
create policy "Admin manage lesson files"
on storage.objects
for all
using (bucket_id = 'lesson-files' and is_admin())
with check (bucket_id = 'lesson-files' and is_admin());

-- Logged students can upload answers to answers folder
drop policy if exists "Students upload answer files" on storage.objects;
create policy "Students upload answer files"
on storage.objects
for insert
with check (
  bucket_id = 'lesson-files'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = 'answers'
);

-- 2. Lesson logs / journal
create table if not exists lesson_logs (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid references slots(id) on delete set null,
  student_id uuid references student_profiles(id) on delete cascade,
  lesson_type_id uuid references lesson_types(id) on delete set null,
  topic_title text not null,
  summary text not null,
  next_steps text,
  comment text,
  created_at timestamp with time zone default now()
);

alter table lesson_logs enable row level security;

drop policy if exists "Admin manage lesson logs" on lesson_logs;
drop policy if exists "Students read own lesson logs" on lesson_logs;

create policy "Admin manage lesson logs"
on lesson_logs
for all
using (is_admin())
with check (is_admin());

create policy "Students read own lesson logs"
on lesson_logs
for select
using (is_student_owner(student_id));

-- 3. Helpful columns if missing
alter table homework add column if not exists file_url text;
alter table homework add column if not exists answer_file_url text;
alter table slots add column if not exists teacher_note text;

-- 4. Optional view for journal
create or replace view admin_lesson_logs_view as
select
  ll.id,
  ll.topic_title,
  ll.summary,
  ll.next_steps,
  ll.comment,
  sp.name as student_name,
  sp.email as student_email,
  s.date,
  s.time,
  lt.title as lesson_type_title,
  ll.created_at
from lesson_logs ll
left join student_profiles sp on sp.id = ll.student_id
left join slots s on s.id = ll.slot_id
left join lesson_types lt on lt.id = ll.lesson_type_id;
