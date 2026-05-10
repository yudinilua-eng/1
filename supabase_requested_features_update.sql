-- =========================================================
-- REQUESTED FEATURES UPDATE SQL
-- Reviews, booking format/direction, reschedule fields,
-- Profi settings, notification email, new prices/discounts.
-- Run after previous SQL files.
-- =========================================================

-- 1. Reviews editable from teacher cabinet
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  author text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  source text,
  text text not null,
  proof_url text,
  photo_url text,
  is_published boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table reviews enable row level security;

drop policy if exists "Public read published reviews" on reviews;
drop policy if exists "Admin manage reviews" on reviews;

create policy "Public read published reviews"
on reviews for select
using (is_published = true);

create policy "Admin manage reviews"
on reviews for all
using (is_admin())
with check (is_admin());

-- 2. Booking request fields for lesson format and preparation direction
alter table booking_requests add column if not exists format text;
alter table booking_requests add column if not exists direction text;

-- 3. Lesson transfer / reschedule fields
alter table lesson_requests add column if not exists slot_id uuid references slots(id) on delete set null;
alter table lesson_requests add column if not exists requested_date date;
alter table lesson_requests add column if not exists requested_time time;

alter table slots add column if not exists teacher_note text;

-- 4. Notification target email and Profi settings
insert into site_settings (key, value, is_public)
values
  ('notification_email', 'bkmz.lby@mail.ru', false),
  ('profi_url', '', true),
  ('profi_achievements', 'Профиль на Profi: добавьте подтверждённый рейтинг, количество отзывов и ссылку на профиль в настройках сайта.', true)
on conflict (key) do update
set value = excluded.value,
    is_public = excluded.is_public,
    updated_at = now();

-- 5. Update lesson type prices: minimum 2000
update lesson_types
set price = case
  when duration <= 60 then greatest(coalesce(price, 0), 2000)
  when duration <= 90 then greatest(coalesce(price, 0), 3000)
  else greatest(coalesce(price, 0), round((duration::numeric / 60) * 2000))
end
where coalesce(price, 0) < case
  when duration <= 60 then 2000
  when duration <= 90 then 3000
  else round((duration::numeric / 60) * 2000)
end;

-- 6. Update default subscription discounts
update subscriptions
set discount_percent = case
  when lessons_count = 4 then 3
  when lessons_count = 8 then 5
  when lessons_count = 12 then 10
  else discount_percent
end
where lessons_count in (4,8,12);

-- 7. Starter lesson types with new prices if missing
insert into lesson_types (title, subject, duration, price, currency, format, description, is_active, sort_order)
select 'Математика · 60 минут', 'Математика', 60, 2000, 'RUB', 'online', 'Индивидуальное онлайн-занятие', true, 10
where not exists (select 1 from lesson_types where title = 'Математика · 60 минут');

insert into lesson_types (title, subject, duration, price, currency, format, description, is_active, sort_order)
select 'Математика · 90 минут', 'Математика', 90, 3000, 'RUB', 'online', 'Углублённое индивидуальное занятие', true, 20
where not exists (select 1 from lesson_types where title = 'Математика · 90 минут');

insert into lesson_types (title, subject, duration, price, currency, format, description, is_active, sort_order)
select 'Физика · 60 минут', 'Физика', 60, 2000, 'RUB', 'online', 'Индивидуальное онлайн-занятие', true, 30
where not exists (select 1 from lesson_types where title = 'Физика · 60 минут');

insert into lesson_types (title, subject, duration, price, currency, format, description, is_active, sort_order)
select 'Химия · 60 минут', 'Химия', 60, 2000, 'RUB', 'online', 'Индивидуальное онлайн-занятие', true, 40
where not exists (select 1 from lesson_types where title = 'Химия · 60 минут');
