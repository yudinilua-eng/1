-- =========================================================
-- FULL SUPABASE SETUP
-- Сайт репетитора: публичная запись, ЛК ученика, ЛК преподавателя,
-- ученики, темы, материалы, ДЗ, слоты, запросы, типы занятий и цены.
--
-- ВАЖНО:
-- 1) Если у вас уже есть важные данные в старых таблицах, НЕ запускайте
--    DROP-блоки без резервной копии.
-- 2) Этот файл рассчитан на новую/чистую структуру.
-- 3) После выполнения SQL назначьте себе роль admin в таблице profiles.
-- =========================================================


-- =========================================================
-- EXTENSIONS
-- =========================================================

create extension if not exists pgcrypto;


-- =========================================================
-- PROFILES / ROLES
-- =========================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'student',
  created_at timestamp with time zone default now()
);

alter table profiles enable row level security;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  );
$$;

create or replace function current_user_email()
returns text
language sql
stable
as $$
  select auth.jwt() ->> 'email';
$$;

drop policy if exists "Users can read own profile" on profiles;
drop policy if exists "Admin can read all profiles" on profiles;
drop policy if exists "Admin can manage profiles" on profiles;

create policy "Users can read own profile"
on profiles
for select
using (id = auth.uid());

create policy "Admin can read all profiles"
on profiles
for select
using (is_admin());

create policy "Admin can manage profiles"
on profiles
for all
using (is_admin())
with check (is_admin());


-- =========================================================
-- STUDENT PROFILES
-- =========================================================

create table if not exists student_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text unique not null,
  subject text,
  notes text,
  active boolean default true,
  created_at timestamp with time zone default now()
);

alter table student_profiles enable row level security;

create or replace function is_student_owner(student_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from student_profiles sp
    where sp.id = student_profile_id
    and (
      sp.auth_user_id = auth.uid()
      or lower(sp.email) = lower(current_user_email())
    )
  );
$$;

drop policy if exists "Admin manage student profiles" on student_profiles;
drop policy if exists "Students read own profile" on student_profiles;
drop policy if exists "Students create own profile" on student_profiles;
drop policy if exists "Students update own profile" on student_profiles;

create policy "Admin manage student profiles"
on student_profiles
for all
using (is_admin())
with check (is_admin());

create policy "Students read own profile"
on student_profiles
for select
using (
  auth.uid() is not null
  and (
    auth_user_id = auth.uid()
    or lower(email) = lower(current_user_email())
  )
);

create policy "Students create own profile"
on student_profiles
for insert
with check (
  auth.uid() is not null
  and lower(email) = lower(current_user_email())
);

create policy "Students update own profile"
on student_profiles
for update
using (
  auth.uid() is not null
  and (
    auth_user_id = auth.uid()
    or lower(email) = lower(current_user_email())
  )
)
with check (
  auth.uid() is not null
  and (
    auth_user_id = auth.uid()
    or lower(email) = lower(current_user_email())
  )
);


-- =========================================================
-- LESSON TYPES / PRICES
-- Типы занятий создаются в ЛК преподавателя:
-- название, предмет, длительность, цена, формат, активность.
-- =========================================================

create table if not exists lesson_types (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text,
  duration integer not null default 60 check (duration > 0),
  price integer not null default 0 check (price >= 0),
  currency text not null default 'RUB',
  format text not null default 'online',
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamp with time zone default now()
);

alter table lesson_types add column if not exists title text;
alter table lesson_types add column if not exists subject text;
alter table lesson_types add column if not exists duration integer not null default 60;
alter table lesson_types add column if not exists price integer not null default 0;
alter table lesson_types add column if not exists currency text not null default 'RUB';
alter table lesson_types add column if not exists format text not null default 'online';
alter table lesson_types add column if not exists description text;
alter table lesson_types add column if not exists is_active boolean not null default true;
alter table lesson_types add column if not exists sort_order integer not null default 100;
alter table lesson_types add column if not exists created_at timestamp with time zone default now();

alter table lesson_types enable row level security;

drop policy if exists "Public can read active lesson types" on lesson_types;
drop policy if exists "Students can read active lesson types" on lesson_types;
drop policy if exists "Admin manage lesson types" on lesson_types;

create policy "Public can read active lesson types"
on lesson_types
for select
using (is_active = true);

create policy "Admin manage lesson types"
on lesson_types
for all
using (is_admin())
with check (is_admin());


-- =========================================================
-- SUBSCRIPTIONS / PACKAGES
-- Абонементы: количество занятий, скидка, срок действия.
-- Можно использовать вместе с lesson_types.
-- =========================================================

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  title text,
  lessons_count integer not null check (lessons_count > 0),
  discount_percent numeric not null default 0 check (discount_percent >= 0),
  valid_days integer not null default 30 check (valid_days > 0),
  is_active boolean not null default true,
  created_at timestamp with time zone default now()
);

alter table subscriptions add column if not exists title text;
alter table subscriptions add column if not exists lessons_count integer;
alter table subscriptions add column if not exists discount_percent numeric not null default 0;
alter table subscriptions add column if not exists valid_days integer not null default 30;
alter table subscriptions add column if not exists is_active boolean not null default true;
alter table subscriptions add column if not exists created_at timestamp with time zone default now();

-- На случай, если lessons_count в старой таблице был пустой
update subscriptions
set lessons_count = 1
where lessons_count is null;

alter table subscriptions alter column lessons_count set not null;

alter table subscriptions enable row level security;

drop policy if exists "Public can read active subscriptions" on subscriptions;
drop policy if exists "Admin manage subscriptions" on subscriptions;

create policy "Public can read active subscriptions"
on subscriptions
for select
using (is_active = true);

create policy "Admin manage subscriptions"
on subscriptions
for all
using (is_admin())
with check (is_admin());


-- =========================================================
-- STUDENT PACKAGES / PAID LESSON BALANCE
-- Продление занятий: преподаватель может выдать/продлить пакет ученику.
-- =========================================================

create table if not exists student_packages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references student_profiles(id) on delete cascade,
  lesson_type_id uuid references lesson_types(id) on delete set null,
  subscription_id uuid references subscriptions(id) on delete set null,
  lessons_total integer not null default 0 check (lessons_total >= 0),
  lessons_used integer not null default 0 check (lessons_used >= 0),
  paid_amount integer default 0 check (paid_amount >= 0),
  currency text not null default 'RUB',
  status text not null default 'active',
  starts_at date default current_date,
  expires_at date,
  notes text,
  created_at timestamp with time zone default now(),
  check (lessons_used <= lessons_total)
);

alter table student_packages enable row level security;

drop policy if exists "Admin manage student packages" on student_packages;
drop policy if exists "Students read own packages" on student_packages;

create policy "Admin manage student packages"
on student_packages
for all
using (is_admin())
with check (is_admin());

create policy "Students read own packages"
on student_packages
for select
using (is_student_owner(student_id));


-- =========================================================
-- TOPICS
-- =========================================================

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text,
  description text,
  created_at timestamp with time zone default now()
);

alter table topics enable row level security;

drop policy if exists "Admin manage topics" on topics;
drop policy if exists "Students read topics" on topics;

create policy "Admin manage topics"
on topics
for all
using (is_admin())
with check (is_admin());

create policy "Students read topics"
on topics
for select
using (auth.uid() is not null);


-- =========================================================
-- MATERIALS
-- =========================================================

-- Если materials уже была создана старой схемой, этот блок добавляет недостающие поля.
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references topics(id) on delete set null,
  student_id uuid references student_profiles(id) on delete cascade,
  title text,
  description text,
  file_url text,
  subject text,
  is_public boolean default false,
  created_at timestamp with time zone default now()
);

alter table materials add column if not exists topic_id uuid references topics(id) on delete set null;
alter table materials add column if not exists student_id uuid references student_profiles(id) on delete cascade;
alter table materials add column if not exists title text;
alter table materials add column if not exists description text;
alter table materials add column if not exists file_url text;
alter table materials add column if not exists subject text;
alter table materials add column if not exists is_public boolean default false;
alter table materials add column if not exists created_at timestamp with time zone default now();

alter table materials enable row level security;

drop policy if exists "Admin manage materials" on materials;
drop policy if exists "Students read assigned materials" on materials;
drop policy if exists "Public read public materials" on materials;
drop policy if exists "Students read materials" on materials;

create policy "Admin manage materials"
on materials
for all
using (is_admin())
with check (is_admin());

create policy "Public read public materials"
on materials
for select
using (is_public = true);

create policy "Students read assigned materials"
on materials
for select
using (
  auth.uid() is not null
  and (
    is_public = true
    or student_id is null
    or is_student_owner(student_id)
  )
);


-- =========================================================
-- HOMEWORK
-- ВАЖНО:
-- Если у вас старая homework.student_id ссылалась на auth.users,
-- лучше удалить старую таблицу и создать заново:
-- drop table if exists homework cascade;
-- =========================================================

create table if not exists homework (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references student_profiles(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  lesson_type_id uuid references lesson_types(id) on delete set null,
  title text not null,
  description text,
  deadline date,
  file_url text,
  answer_text text,
  answer_file_url text,
  teacher_comment text,
  is_done boolean default false,
  created_at timestamp with time zone default now()
);

alter table homework add column if not exists title text;
alter table homework add column if not exists description text;
alter table homework add column if not exists student_id uuid references student_profiles(id) on delete cascade;
alter table homework add column if not exists topic_id uuid references topics(id) on delete set null;
alter table homework add column if not exists lesson_type_id uuid references lesson_types(id) on delete set null;
alter table homework add column if not exists deadline date;
alter table homework add column if not exists file_url text;
alter table homework add column if not exists answer_text text;
alter table homework add column if not exists answer_file_url text;
alter table homework add column if not exists teacher_comment text;
alter table homework add column if not exists is_done boolean default false;
alter table homework add column if not exists created_at timestamp with time zone default now();

alter table homework enable row level security;

drop policy if exists "Admin manage homework" on homework;
drop policy if exists "Students read own homework" on homework;
drop policy if exists "Students update own homework" on homework;
drop policy if exists "Students read own homework v2" on homework;
drop policy if exists "Students update own homework v2" on homework;

create policy "Admin manage homework"
on homework
for all
using (is_admin())
with check (is_admin());

create policy "Students read own homework"
on homework
for select
using (is_student_owner(student_id));

create policy "Students update own homework"
on homework
for update
using (is_student_owner(student_id))
with check (is_student_owner(student_id));


-- =========================================================
-- SLOTS / SCHEDULE
-- Слоты могут ссылаться на lesson_types:
-- тип занятия задаёт длительность и цену.
-- =========================================================

create table if not exists slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time text not null,
  duration integer default 60,
  status text not null default 'closed',
  lesson_type_id uuid references lesson_types(id) on delete set null,
  price integer,
  currency text default 'RUB',
  student_name text,
  student_contact text,
  student_id uuid references auth.users(id) on delete set null,
  student_profile_id uuid references student_profiles(id) on delete set null,
  teacher_note text,
  google_event_url text,
  created_at timestamp with time zone default now()
);

alter table slots add column if not exists lesson_type_id uuid references lesson_types(id) on delete set null;
alter table slots add column if not exists price integer;
alter table slots add column if not exists currency text default 'RUB';
alter table slots add column if not exists student_profile_id uuid references student_profiles(id) on delete set null;
alter table slots add column if not exists teacher_note text;
alter table slots add column if not exists google_event_url text;
alter table slots add column if not exists created_at timestamp with time zone default now();

alter table slots enable row level security;

drop policy if exists "Public can read open slots" on slots;
drop policy if exists "Students read own booked slots" on slots;
drop policy if exists "Public can book open slots" on slots;
drop policy if exists "Admin manage slots" on slots;
drop policy if exists "Admin can read all slots" on slots;
drop policy if exists "Admin can insert slots" on slots;
drop policy if exists "Admin can update slots" on slots;
drop policy if exists "Admin can delete slots" on slots;

create policy "Public can read open slots"
on slots
for select
using (status = 'open');

create policy "Students read own booked slots"
on slots
for select
using (
  status = 'open'
  or is_admin()
  or (
    student_profile_id is not null
    and is_student_owner(student_profile_id)
  )
);

create policy "Public can book open slots"
on slots
for update
using (status = 'open')
with check (status = 'booked');

create policy "Admin manage slots"
on slots
for all
using (is_admin())
with check (is_admin());


-- =========================================================
-- PUBLIC REQUESTS FROM CONTACT FORM
-- =========================================================

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  contact text,
  subject text,
  message text,
  created_at timestamp with time zone default now()
);

alter table requests enable row level security;

drop policy if exists "Anyone can create request" on requests;
drop policy if exists "Admin can read requests" on requests;
drop policy if exists "Admin manage requests" on requests;

create policy "Anyone can create request"
on requests
for insert
with check (true);

create policy "Admin can read requests"
on requests
for select
using (is_admin());

create policy "Admin manage requests"
on requests
for all
using (is_admin())
with check (is_admin());


-- =========================================================
-- LESSON REQUESTS
-- Перенос занятия, продление, вопрос преподавателю.
-- =========================================================

create table if not exists lesson_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references student_profiles(id) on delete cascade,
  slot_id uuid references slots(id) on delete set null,
  package_id uuid references student_packages(id) on delete set null,
  type text not null default 'question',
  message text not null,
  status text not null default 'pending',
  teacher_comment text,
  created_at timestamp with time zone default now()
);

alter table lesson_requests add column if not exists package_id uuid references student_packages(id) on delete set null;
alter table lesson_requests add column if not exists teacher_comment text;

alter table lesson_requests enable row level security;

drop policy if exists "Admin manage lesson requests" on lesson_requests;
drop policy if exists "Students manage own lesson requests" on lesson_requests;

create policy "Admin manage lesson requests"
on lesson_requests
for all
using (is_admin())
with check (is_admin());

create policy "Students manage own lesson requests"
on lesson_requests
for all
using (is_student_owner(student_id))
with check (is_student_owner(student_id));


-- =========================================================
-- PAYMENTS / PAYMENT RECORDS
-- Не обязательная таблица, но полезна для оплат и продлений.
-- =========================================================

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references student_profiles(id) on delete set null,
  lesson_type_id uuid references lesson_types(id) on delete set null,
  subscription_id uuid references subscriptions(id) on delete set null,
  package_id uuid references student_packages(id) on delete set null,
  amount integer not null default 0 check (amount >= 0),
  currency text not null default 'RUB',
  status text not null default 'pending',
  method text,
  external_payment_id text,
  notes text,
  created_at timestamp with time zone default now()
);

alter table payments enable row level security;

drop policy if exists "Admin manage payments" on payments;
drop policy if exists "Students read own payments" on payments;

create policy "Admin manage payments"
on payments
for all
using (is_admin())
with check (is_admin());

create policy "Students read own payments"
on payments
for select
using (student_id is not null and is_student_owner(student_id));


-- =========================================================
-- GOOGLE INTEGRATION SETTINGS
-- Без секретов OAuth в HTML.
-- Здесь можно хранить публичные настройки/ссылки.
-- OAuth client_secret / refresh_token хранить только в Edge Functions secrets.
-- =========================================================

create table if not exists integration_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  key text not null,
  value text,
  is_public boolean default false,
  created_at timestamp with time zone default now(),
  unique(provider, key)
);

alter table integration_settings enable row level security;

drop policy if exists "Public read public integration settings" on integration_settings;
drop policy if exists "Admin manage integration settings" on integration_settings;

create policy "Public read public integration settings"
on integration_settings
for select
using (is_public = true);

create policy "Admin manage integration settings"
on integration_settings
for all
using (is_admin())
with check (is_admin());


-- =========================================================
-- HELPER VIEWS
-- Удобные представления для админки.
-- =========================================================

create or replace view admin_slots_view as
select
  s.id,
  s.date,
  s.time,
  s.duration,
  s.status,
  s.price,
  s.currency,
  s.student_name,
  s.student_contact,
  sp.name as student_profile_name,
  sp.email as student_profile_email,
  lt.title as lesson_type_title,
  lt.subject as lesson_type_subject,
  lt.price as lesson_type_price,
  lt.duration as lesson_type_duration,
  s.created_at
from slots s
left join student_profiles sp on sp.id = s.student_profile_id
left join lesson_types lt on lt.id = s.lesson_type_id;

create or replace view admin_homework_view as
select
  h.id,
  h.title,
  h.description,
  h.deadline,
  h.is_done,
  h.answer_text,
  h.teacher_comment,
  sp.name as student_name,
  sp.email as student_email,
  t.title as topic_title,
  lt.title as lesson_type_title,
  h.created_at
from homework h
left join student_profiles sp on sp.id = h.student_id
left join topics t on t.id = h.topic_id
left join lesson_types lt on lt.id = h.lesson_type_id;


-- =========================================================
-- STARTER DATA
-- Можно удалить/изменить.
-- =========================================================

insert into lesson_types (title, subject, duration, price, currency, format, description, sort_order)
values
  ('Математика · 60 минут', 'Математика', 60, 1500, 'RUB', 'online', 'Индивидуальное онлайн-занятие по математике', 10),
  ('Математика · 90 минут', 'Математика', 90, 2200, 'RUB', 'online', 'Углублённое индивидуальное онлайн-занятие по математике', 11),
  ('Физика · 60 минут', 'Физика', 60, 1500, 'RUB', 'online', 'Индивидуальное онлайн-занятие по физике', 20),
  ('Физика · 90 минут', 'Физика', 90, 2200, 'RUB', 'online', 'Углублённое индивидуальное онлайн-занятие по физике', 21),
  ('Химия · 60 минут', 'Химия', 60, 1500, 'RUB', 'online', 'Индивидуальное онлайн-занятие по химии', 30),
  ('Химия · 90 минут', 'Химия', 90, 2200, 'RUB', 'online', 'Углублённое индивидуальное онлайн-занятие по химии', 31)
on conflict do nothing;

insert into subscriptions (title, lessons_count, discount_percent, valid_days, is_active)
values
  ('Разовое занятие', 1, 0, 30, true),
  ('Абонемент на 4 занятия', 4, 5, 30, true),
  ('Абонемент на 8 занятий', 8, 10, 30, true),
  ('Абонемент на 12 занятий', 12, 15, 45, true)
on conflict do nothing;

insert into topics (title, subject, description)
values
  ('Квадратные уравнения', 'Математика', 'Базовые методы решения и типовые ошибки'),
  ('Законы Ньютона', 'Физика', 'Динамика, силы, второй закон Ньютона'),
  ('Цепочки превращений', 'Химия', 'Органическая и неорганическая химия')
on conflict do nothing;


-- =========================================================
-- HOW TO MAKE YOURSELF ADMIN
-- После создания пользователя в Authentication → Users:
--
-- insert into profiles (id, email, role)
-- values (
--   'ВАШ_USER_UID',
--   'ваш_email@example.com',
--   'admin'
-- )
-- on conflict (id) do update
-- set email = excluded.email, role = 'admin';
-- =========================================================
