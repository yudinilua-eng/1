-- =========================================================
-- BOOKING WITHOUT SLOT / DIAGNOSTIC UPDATE
-- Run after previous SQL files.
-- =========================================================

alter table booking_requests alter column slot_id drop not null;
alter table booking_requests add column if not exists format text;
alter table booking_requests add column if not exists direction text;
alter table booking_requests add column if not exists is_diagnostic boolean not null default true;

insert into site_settings (key, value, is_public)
values
  ('diagnostic_title', 'Бесплатная диагностика перед стартом', true),
  ('diagnostic_text', 'Определим уровень, пробелы и удобный формат занятий. После диагностики составим понятный план подготовки.', true)
on conflict (key) do update
set value = excluded.value,
    is_public = excluded.is_public,
    updated_at = now();
