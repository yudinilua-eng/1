-- =========================================================
-- v7: вход ученика по логину/имени и паролю + Яндекс-папки
-- Выполнять после основных SQL-файлов проекта.
-- =========================================================

create extension if not exists pgcrypto;

alter table if exists public.student_profiles
  add column if not exists student_login text,
  add column if not exists portal_password_hash text,
  add column if not exists portal_salt text,
  add column if not exists portal_access_enabled boolean default false,
  add column if not exists yandex_folder_url text,
  add column if not exists telegram text,
  add column if not exists updated_at timestamp with time zone default now();

alter table if exists public.student_profiles
  alter column email drop not null;

create unique index if not exists idx_student_profiles_student_login_lower
  on public.student_profiles (lower(student_login))
  where student_login is not null;

create table if not exists public.student_portal_sessions (
  token uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone default (now() + interval '30 days')
);

alter table public.student_portal_sessions enable row level security;

drop policy if exists "Admin manage student portal sessions" on public.student_portal_sessions;
create policy "Admin manage student portal sessions"
on public.student_portal_sessions
for all
using (public.is_admin())
with check (public.is_admin());

create or replace function public.portal_hash_password(p_salt text, p_password text)
returns text
language sql
immutable
as $$
  select encode(digest(coalesce(p_salt,'') || coalesce(p_password,''), 'sha256'), 'hex');
$$;

create or replace function public.teacher_set_student_portal_credentials(
  p_student_id uuid,
  p_login text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salt text;
begin
  if not public.is_admin() then
    raise exception 'Доступ запрещён: нужна роль admin';
  end if;

  if p_student_id is null or nullif(trim(p_login), '') is null or nullif(p_password, '') is null then
    raise exception 'Нужны ученик, логин и пароль';
  end if;

  v_salt := encode(gen_random_bytes(16), 'hex');

  update public.student_profiles
  set
    student_login = trim(p_login),
    portal_salt = v_salt,
    portal_password_hash = public.portal_hash_password(v_salt, p_password),
    portal_access_enabled = true,
    updated_at = coalesce(updated_at, now())
  where id = p_student_id;

  delete from public.student_portal_sessions where student_id = p_student_id;

  return jsonb_build_object('ok', true, 'student_id', p_student_id, 'login', trim(p_login));
end;
$$;

create or replace function public.teacher_create_student_with_portal(
  p_name text,
  p_email text,
  p_subject text,
  p_telegram text,
  p_yandex_folder_url text,
  p_login text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_salt text;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Доступ запрещён: нужна роль admin';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Укажите имя ученика';
  end if;
  if nullif(trim(p_login), '') is null then
    raise exception 'Укажите логин ученика';
  end if;
  if nullif(p_password, '') is null then
    raise exception 'Укажите пароль ученика';
  end if;

  v_salt := encode(gen_random_bytes(16), 'hex');
  v_email := nullif(trim(p_email), '');

  insert into public.student_profiles (
    name,
    email,
    subject,
    telegram,
    yandex_folder_url,
    student_login,
    portal_salt,
    portal_password_hash,
    portal_access_enabled,
    active
  ) values (
    trim(p_name),
    v_email,
    nullif(trim(p_subject), ''),
    nullif(trim(p_telegram), ''),
    nullif(trim(p_yandex_folder_url), ''),
    trim(p_login),
    v_salt,
    public.portal_hash_password(v_salt, p_password),
    true,
    true
  )
  returning id into v_student_id;

  return jsonb_build_object('ok', true, 'student_id', v_student_id, 'login', trim(p_login));
end;
$$;

create or replace function public.student_portal_login(p_login text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.student_profiles%rowtype;
  v_token uuid;
begin
  select * into v_student
  from public.student_profiles
  where portal_access_enabled = true
    and active = true
    and lower(student_login) = lower(trim(p_login))
    and portal_password_hash = public.portal_hash_password(portal_salt, p_password)
  limit 1;

  if not found then
    raise exception 'Неверный логин или пароль';
  end if;

  insert into public.student_portal_sessions(student_id)
  values (v_student.id)
  returning token into v_token;

  return jsonb_build_object(
    'token', v_token,
    'profile', jsonb_build_object(
      'id', v_student.id,
      'name', v_student.name,
      'email', v_student.email,
      'subject', v_student.subject,
      'telegram', v_student.telegram,
      'notes', v_student.notes,
      'active', v_student.active,
      'student_login', v_student.student_login,
      'yandex_folder_url', v_student.yandex_folder_url
    )
  );
end;
$$;

create or replace function public.student_portal_data(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_profile jsonb;
begin
  select s.student_id into v_student_id
  from public.student_portal_sessions s
  join public.student_profiles sp on sp.id = s.student_id
  where s.token = p_token
    and s.expires_at > now()
    and sp.active = true
    and sp.portal_access_enabled = true
  limit 1;

  if v_student_id is null then
    raise exception 'Сессия ученика истекла';
  end if;

  update public.student_portal_sessions
  set expires_at = now() + interval '30 days'
  where token = p_token;

  select jsonb_build_object(
    'id', id,
    'name', name,
    'email', email,
    'subject', subject,
    'telegram', telegram,
    'notes', notes,
    'active', active,
    'student_login', student_login,
    'yandex_folder_url', yandex_folder_url
  ) into v_profile
  from public.student_profiles
  where id = v_student_id;

  return jsonb_build_object(
    'profile', v_profile,
    'materials', coalesce((
      select jsonb_agg(to_jsonb(m) || jsonb_build_object('topics', jsonb_build_object('title', t.title)))
      from public.materials m
      left join public.topics t on t.id = m.topic_id
      where m.student_id is null or m.student_id = v_student_id
    ), '[]'::jsonb),
    'homework', coalesce((
      select jsonb_agg(to_jsonb(h) || jsonb_build_object(
        'topics', jsonb_build_object('title', t.title),
        'lesson_types', jsonb_build_object('title', lt.title, 'price', lt.price, 'duration', lt.duration)
      ) order by h.deadline nulls last, h.created_at desc)
      from public.homework h
      left join public.topics t on t.id = h.topic_id
      left join public.lesson_types lt on lt.id = h.lesson_type_id
      where h.student_id = v_student_id
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(to_jsonb(sl) || jsonb_build_object('lesson_types', jsonb_build_object('title', lt.title, 'subject', lt.subject, 'price', lt.price, 'duration', lt.duration)) order by sl.date, sl.time)
      from public.slots sl
      left join public.lesson_types lt on lt.id = sl.lesson_type_id
      where sl.student_profile_id = v_student_id
    ), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.lesson_requests r where r.student_id = v_student_id), '[]'::jsonb),
    'packages', coalesce((
      select jsonb_agg(to_jsonb(p) || jsonb_build_object(
        'lesson_types', jsonb_build_object('title', lt.title, 'price', lt.price, 'duration', lt.duration),
        'subscriptions', jsonb_build_object('title', sub.title, 'lessons_count', sub.lessons_count, 'discount_percent', sub.discount_percent)
      ) order by p.created_at desc)
      from public.student_packages p
      left join public.lesson_types lt on lt.id = p.lesson_type_id
      left join public.subscriptions sub on sub.id = p.subscription_id
      where p.student_id = v_student_id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(pay) || jsonb_build_object('lesson_types', jsonb_build_object('title', lt.title)) order by pay.created_at desc)
      from public.payments pay
      left join public.lesson_types lt on lt.id = pay.lesson_type_id
      where pay.student_id = v_student_id
    ), '[]'::jsonb),
    'lesson_logs', coalesce((
      select jsonb_agg(to_jsonb(l) || jsonb_build_object(
        'lesson_types', jsonb_build_object('title', lt.title),
        'slots', jsonb_build_object('date', sl.date, 'time', sl.time)
      ) order by l.created_at desc)
      from public.lesson_logs l
      left join public.lesson_types lt on lt.id = l.lesson_type_id
      left join public.slots sl on sl.id = l.slot_id
      where l.student_id = v_student_id
    ), '[]'::jsonb),
    'quizzes', coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from public.quizzes q where q.is_active = true and (q.student_id is null or q.student_id = v_student_id)), '[]'::jsonb),
    'quiz_questions', coalesce((select jsonb_agg(to_jsonb(qq) order by qq.created_at) from public.quiz_questions qq), '[]'::jsonb),
    'quiz_attempts', coalesce((select jsonb_agg(to_jsonb(qa) order by qa.created_at desc) from public.quiz_attempts qa where qa.student_id = v_student_id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.student_portal_update_homework(
  p_token uuid,
  p_homework_id uuid,
  p_answer_text text,
  p_answer_file_url text,
  p_is_done boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  select student_id into v_student_id
  from public.student_portal_sessions
  where token = p_token and expires_at > now();

  if v_student_id is null then
    raise exception 'Сессия ученика истекла';
  end if;

  update public.homework
  set
    answer_text = coalesce(p_answer_text, answer_text),
    answer_file_url = coalesce(p_answer_file_url, answer_file_url),
    is_done = coalesce(p_is_done, is_done),
    submitted_at = case when coalesce(p_is_done, false) then now() else submitted_at end
  where id = p_homework_id and student_id = v_student_id;

  if not found then
    raise exception 'ДЗ не найдено';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.student_portal_create_request(
  p_token uuid,
  p_type text,
  p_slot_id uuid,
  p_requested_date date,
  p_requested_time time,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_request_id uuid;
begin
  select student_id into v_student_id
  from public.student_portal_sessions
  where token = p_token and expires_at > now();

  if v_student_id is null then
    raise exception 'Сессия ученика истекла';
  end if;

  insert into public.lesson_requests(student_id, type, slot_id, requested_date, requested_time, message, status)
  values (v_student_id, coalesce(nullif(p_type,''), 'question'), p_slot_id, p_requested_date, p_requested_time, p_message, 'pending')
  returning id into v_request_id;

  return jsonb_build_object('ok', true, 'request_id', v_request_id);
end;
$$;

create index if not exists idx_student_portal_sessions_student_id on public.student_portal_sessions(student_id);
create index if not exists idx_student_portal_sessions_expires_at on public.student_portal_sessions(expires_at);
