-- =========================================================
-- DIAGNOSTIC WORDING POLISH
-- Run after previous SQL files if you want to update stored settings.
-- =========================================================

insert into site_settings (key, value, is_public)
values
  ('diagnostic_title', 'Бесплатный анализ результатов диагностики', true),
  ('diagnostic_text', 'После диагностики вы получите бесплатный анализ: текущий уровень, пробелы и рекомендации по плану подготовки. Знакомство и короткий разбор для старта — 15–20 минут за 700 ₽.', true)
on conflict (key) do update
set value = excluded.value,
    is_public = excluded.is_public,
    updated_at = now();
