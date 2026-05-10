-- =========================================================
-- TRIAL LESSON / DIAGNOSTIC WORDING UPDATE
-- Run after previous SQL files.
-- =========================================================

insert into lesson_types (title, subject, duration, price, currency, format, description, is_active, sort_order)
select 'Пробный урок · 15–20 минут', 'Диагностика', 20, 700, 'RUB', 'online',
       'Пробный урок со скидкой. Результаты диагностики и рекомендации после урока — бесплатно.',
       true, 1
where not exists (
  select 1 from lesson_types where title = 'Пробный урок · 15–20 минут'
);

insert into site_settings (key, value, is_public)
values
  ('diagnostic_title', 'Пробный урок 15–20 минут за 700 ₽', true),
  ('diagnostic_text', 'После пробного урока вы бесплатно получаете результаты диагностики: уровень, пробелы и рекомендации по плану подготовки.', true)
on conflict (key) do update
set value = excluded.value,
    is_public = excluded.is_public,
    updated_at = now();
