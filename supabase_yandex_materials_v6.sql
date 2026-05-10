-- v6: отказ от Google-синхронизации и переход на личные Яндекс-папки учеников
-- Выполнить в Supabase SQL Editor после загрузки index.html v6.

alter table if exists public.student_profiles
  add column if not exists yandex_folder_url text;

comment on column public.student_profiles.yandex_folder_url is 'Личная папка ученика на Яндекс.Диске для конспектов, ДЗ и материалов';

-- Индексы для ускорения частых разделов ЛК
create index if not exists idx_student_profiles_email on public.student_profiles(email);
create index if not exists idx_student_profiles_subject on public.student_profiles(subject);
create index if not exists idx_materials_student_id on public.materials(student_id);
create index if not exists idx_materials_topic_id on public.materials(topic_id);
create index if not exists idx_homework_student_id on public.homework(student_id);
create index if not exists idx_homework_deadline on public.homework(deadline);
create index if not exists idx_slots_date_time on public.slots(date, time);
create index if not exists idx_slots_status on public.slots(status);
create index if not exists idx_reviews_published on public.reviews(is_published);
create index if not exists idx_student_cases_published on public.student_cases(is_published);
create index if not exists idx_lesson_examples_published on public.lesson_examples(is_published);

-- Если в проекте осталась очередь Google, она больше не используется сайтом v6.
-- Можно оставить таблицу для истории, удалять её необязательно.
