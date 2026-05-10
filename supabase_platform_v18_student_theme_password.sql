-- v18: актуальные пароли учеников для преподавателя, смена пароля учеником, темы ЛК и стабильные credentials.
-- Выполнять после SQL из v17. Скрипт безопасен для повторного запуска.
create extension if not exists pgcrypto;

alter table if exists public.student_profiles
  add column if not exists telegram text,
  add column if not exists yandex_folder_url text,
  add column if not exists notes text,
  add column if not exists status text default 'active',
  add column if not exists ui_theme text default 'calm';

create table if not exists public.student_credentials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  login_name text not null unique,
  password_hash text not null,
  password_plain text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.student_credentials
  add column if not exists password_plain text,
  add column if not exists is_active boolean default true,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_student_credentials_student_id on public.student_credentials(student_id);
create index if not exists idx_student_credentials_login_name on public.student_credentials(login_name);
create index if not exists idx_student_profiles_status on public.student_profiles(status);
create index if not exists idx_student_profiles_subject on public.student_profiles(subject);

create or replace function public.platform_normalize_student_login(p_login text)
returns text language sql immutable as $$
  select regexp_replace(regexp_replace(lower(trim(coalesce(p_login,''))), '\s+', '_', 'g'), '[^a-z0-9._-]', '', 'g');
$$;

create or replace function public.is_platform_teacher()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role,'') in ('admin','teacher')
  );
$$;

create or replace function public.teacher_create_student_access_v18(
  p_name text,
  p_login_name text,
  p_password_hash text,
  p_password_plain text default null,
  p_email text default null,
  p_subject text default null,
  p_telegram text default null,
  p_yandex_folder_url text default null,
  p_notes text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_student_id uuid;
  v_login text;
begin
  if not public.is_platform_teacher() then
    raise exception 'Нет прав преподавателя. В profiles должно быть role = admin или teacher.';
  end if;

  v_login := public.platform_normalize_student_login(p_login_name);
  if length(v_login) < 3 then raise exception 'Логин должен быть не короче 3 символов'; end if;
  if p_password_hash is null or length(p_password_hash) < 32 then raise exception 'Password hash is missing'; end if;
  if exists (select 1 from public.student_credentials where login_name = v_login) then
    raise exception 'Такой логин уже занят. Выберите другой.';
  end if;

  insert into public.student_profiles(name,email,subject,telegram,yandex_folder_url,notes,status)
  values (
    coalesce(nullif(trim(p_name),''), v_login),
    coalesce(nullif(trim(coalesce(p_email,'')),''), v_login || '@student.local'),
    nullif(trim(coalesce(p_subject,'')),''),
    nullif(trim(coalesce(p_telegram,'')),''),
    nullif(trim(coalesce(p_yandex_folder_url,'')),''),
    nullif(trim(coalesce(p_notes,'')),''),
    'active'
  ) returning id into v_student_id;

  insert into public.student_credentials(student_id,login_name,password_hash,password_plain,is_active)
  values (v_student_id, v_login, p_password_hash, nullif(p_password_plain,''), true);

  return jsonb_build_object(
    'student_id', v_student_id,
    'id', v_student_id,
    'login_name', v_login,
    'current_password', nullif(p_password_plain,''),
    'name', coalesce(nullif(trim(p_name),''), v_login),
    'email', coalesce(nullif(trim(coalesce(p_email,'')),''), v_login || '@student.local'),
    'subject', nullif(trim(coalesce(p_subject,'')),''),
    'telegram', nullif(trim(coalesce(p_telegram,'')),''),
    'yandex_folder_url', nullif(trim(coalesce(p_yandex_folder_url,'')),''),
    'notes', nullif(trim(coalesce(p_notes,'')),''),
    'status', 'active'
  );
end;
$$;

create or replace function public.student_login_full_v18(p_login_name text, p_password_hash text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_student public.student_profiles%rowtype;
  v_login text;
begin
  v_login := public.platform_normalize_student_login(p_login_name);
  select sp.* into v_student
  from public.student_credentials c
  join public.student_profiles sp on sp.id = c.student_id
  where c.login_name = v_login
    and c.password_hash = p_password_hash
    and c.is_active = true
  limit 1;

  if v_student.id is null then
    raise exception 'Неверное имя или пароль.';
  end if;

  return to_jsonb(v_student) || jsonb_build_object('login_name', v_login);
end;
$$;

create or replace function public.student_login_full_v17(p_login_name text, p_password_hash text)
returns jsonb language sql security definer set search_path=public as $$
  select public.student_login_full_v18($1,$2);
$$;

create or replace function public.student_login_by_password_v18(p_login_name text, p_password_hash text)
returns uuid language sql security definer set search_path = public as $$
  select (public.student_login_full_v18($1,$2)->>'id')::uuid;
$$;
create or replace function public.student_login_by_password_v17(p_login_name text,p_password_hash text)
returns uuid language sql security definer set search_path=public as $$ select public.student_login_by_password_v18($1,$2); $$;
create or replace function public.student_login_by_password_v16(p_login_name text,p_password_hash text)
returns uuid language sql security definer set search_path=public as $$ select public.student_login_by_password_v18($1,$2); $$;
create or replace function public.student_login_by_password(p_login_name text,p_password_hash text)
returns uuid language sql security definer set search_path=public as $$ select public.student_login_by_password_v18($1,$2); $$;

create or replace function public.list_student_credentials_for_teacher_v18(p_student_ids uuid[])
returns table(student_id uuid, login_name text, current_password text, is_active boolean, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_teacher() then raise exception 'Нет прав преподавателя.'; end if;
  return query
    select c.student_id, c.login_name, c.password_plain as current_password, c.is_active, c.updated_at
    from public.student_credentials c
    where c.student_id = any(coalesce(p_student_ids, array[]::uuid[]));
end;
$$;

create or replace function public.teacher_update_student_login_v18(p_student_id uuid, p_login_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_login text;
begin
  if not public.is_platform_teacher() then raise exception 'Нет прав преподавателя.'; end if;
  v_login := public.platform_normalize_student_login(p_login_name);
  if length(v_login) < 3 then raise exception 'Логин должен быть не короче 3 символов'; end if;
  if exists (select 1 from public.student_credentials where login_name = v_login and student_id <> p_student_id) then
    raise exception 'Такой логин уже занят.';
  end if;
  update public.student_credentials
  set login_name = v_login, updated_at = now()
  where student_id = p_student_id;
  if not found then raise exception 'Логин ученика не найден.'; end if;
end;
$$;

create or replace function public.teacher_update_student_login_v17(p_student_id uuid, p_login_name text)
returns void language sql security definer set search_path=public as $$ select public.teacher_update_student_login_v18($1,$2); $$;

create or replace function public.teacher_reset_student_password_v18(p_student_id uuid, p_password_hash text, p_password_plain text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_teacher() then raise exception 'Нет прав преподавателя.'; end if;
  update public.student_credentials
  set password_hash=p_password_hash, password_plain=nullif(p_password_plain,''), is_active=true, updated_at=now()
  where student_id=p_student_id;
  if not found then raise exception 'Логин ученика не найден.'; end if;
end;
$$;

create or replace function public.student_change_own_password_v18(p_student_id uuid, p_password_hash text, p_password_plain text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_student_id is null then raise exception 'Не найден ученик.'; end if;
  if p_password_hash is null or length(p_password_hash) < 32 then raise exception 'Некорректный пароль.'; end if;
  update public.student_credentials
  set password_hash=p_password_hash, password_plain=nullif(p_password_plain,''), is_active=true, updated_at=now()
  where student_id=p_student_id and is_active=true;
  if not found then raise exception 'Доступ ученика не найден.'; end if;
end;
$$;

-- Совместимость со старыми именами функций.
create or replace function public.teacher_create_student_access_v17(p_name text,p_login_name text,p_password_hash text,p_password_plain text default null,p_email text default null,p_subject text default null,p_telegram text default null,p_yandex_folder_url text default null,p_notes text default null)
returns jsonb language sql security definer set search_path=public as $$ select public.teacher_create_student_access_v18($1,$2,$3,$4,$5,$6,$7,$8,$9); $$;
-- Старые вызовы без p_password_plain тоже оставляем.
create or replace function public.teacher_create_student_access_v17(p_name text,p_login_name text,p_password_hash text,p_email text default null,p_subject text default null,p_telegram text default null,p_yandex_folder_url text default null,p_notes text default null)
returns jsonb language sql security definer set search_path=public as $$ select public.teacher_create_student_access_v18($1,$2,$3,null,$4,$5,$6,$7,$8); $$;
create or replace function public.teacher_create_student_access_v15(p_name text,p_login_name text,p_password_hash text,p_email text default null,p_subject text default null,p_telegram text default null,p_yandex_folder_url text default null,p_notes text default null)
returns jsonb language sql security definer set search_path=public as $$ select public.teacher_create_student_access_v18($1,$2,$3,null,$4,$5,$6,$7,$8); $$;
create or replace function public.teacher_create_student_access(p_name text,p_login_name text,p_password_hash text,p_email text default null,p_subject text default null,p_telegram text default null,p_yandex_folder_url text default null,p_notes text default null)
returns uuid language sql security definer set search_path=public as $$ select (public.teacher_create_student_access_v18($1,$2,$3,null,$4,$5,$6,$7,$8)->>'student_id')::uuid; $$;

create or replace function public.teacher_reset_student_password_v17(p_student_id uuid,p_password_hash text,p_password_plain text default null)
returns void language sql security definer set search_path=public as $$ select public.teacher_reset_student_password_v18($1,$2,$3); $$;
create or replace function public.teacher_reset_student_password_v16(p_student_id uuid,p_password_hash text)
returns void language sql security definer set search_path=public as $$ select public.teacher_reset_student_password_v18($1,$2,null); $$;
create or replace function public.teacher_reset_student_password_v15(p_student_id uuid,p_password_hash text)
returns void language sql security definer set search_path=public as $$ select public.teacher_reset_student_password_v18($1,$2,null); $$;
create or replace function public.teacher_reset_student_password(p_student_id uuid,p_password_hash text)
returns void language sql security definer set search_path=public as $$ select public.teacher_reset_student_password_v18($1,$2,null); $$;

grant execute on function public.teacher_create_student_access_v18(text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.teacher_create_student_access_v17(text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.student_login_full_v18(text,text) to anon, authenticated;
grant execute on function public.student_login_full_v17(text,text) to anon, authenticated;
grant execute on function public.student_login_by_password_v18(text,text) to anon, authenticated;
grant execute on function public.list_student_credentials_for_teacher_v18(uuid[]) to authenticated;
grant execute on function public.teacher_update_student_login_v18(uuid,text) to authenticated;
grant execute on function public.teacher_reset_student_password_v18(uuid,text,text) to authenticated;
grant execute on function public.student_change_own_password_v18(uuid,text,text) to anon, authenticated;
