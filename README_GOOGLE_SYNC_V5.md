# Подключение Google Calendar / Sheets / Drive через Supabase Edge Function

В проекте уже есть рабочая функция:

```text
supabase/functions/process-google-sync/index.ts
```

Она обрабатывает очередь:

```text
google_sync_events
```

и отправляет события в:

```text
Google Calendar — слоты и занятия
Google Sheets — ученики, оплаты, домашние задания
Google Drive — материалы
```

## 1. Выполни SQL

В Supabase → SQL Editor выполни:

```text
supabase_google_sync_v5.sql
```

Перед этим должен быть выполнен файл:

```text
supabase_platform_optimization_v4.sql
```

## 2. Создай Google Cloud Service Account

1. Открой Google Cloud Console.
2. Создай проект или выбери существующий.
3. Включи API:
   - Google Calendar API
   - Google Sheets API
   - Google Drive API
4. Создай Service Account.
5. Создай JSON key.
6. Скачай JSON.

## 3. Подготовь Google Calendar

1. Открой нужный календарь Google.
2. Настройки календаря → Доступ для отдельных пользователей.
3. Добавь email сервисного аккаунта из JSON, например:

```text
platform-sync@project-id.iam.gserviceaccount.com
```

4. Дай права:

```text
Вносить изменения в мероприятия
```

5. Скопируй Calendar ID.

## 4. Подготовь Google Sheets

Создай таблицу и добавь в ней листы с такими названиями:

```text
Students
Payments
Homework
Events
```

Добавь сервисный аккаунт как редактора таблицы.

Скопируй ID таблицы из ссылки:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

## 5. Подготовь Google Drive

Создай папку для материалов и добавь сервисный аккаунт как редактора.

Скопируй Folder ID из ссылки папки:

```text
https://drive.google.com/drive/folders/FOLDER_ID
```

## 6. Установи Supabase secrets

Локально установи Supabase CLI, затем выполни:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Добавь секреты:

```bash
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='PASTE_FULL_JSON_HERE'
supabase secrets set GOOGLE_CALENDAR_ID="YOUR_GOOGLE_CALENDAR_ID"
supabase secrets set GOOGLE_SHEET_ID="YOUR_GOOGLE_SHEET_ID"
supabase secrets set GOOGLE_DRIVE_FOLDER_ID="YOUR_GOOGLE_DRIVE_FOLDER_ID"
supabase secrets set GOOGLE_TIMEZONE="Europe/Zurich"
supabase secrets set SYNC_SECRET="любой-длинный-секрет-для-запуска-функции"
```

Важно: `SUPABASE_SERVICE_ROLE_KEY` нельзя добавлять в GitHub, Vercel или `index.html`.
Он должен быть только в Supabase Edge Function Secrets.

## 7. Задеплой функцию

Из корня проекта:

```bash
supabase functions deploy process-google-sync --no-verify-jwt
```

## 8. Проверка вручную

Создай в ЛК преподавателя новый слот или ученика, затем вызови функцию:

```bash
curl -X POST "https://YOUR_PROJECT_REF.functions.supabase.co/process-google-sync" \
  -H "Authorization: Bearer YOUR_SYNC_SECRET"
```

Если всё работает, в таблице `google_sync_events` статус станет:

```text
processed
```

А данные появятся в Google Calendar / Sheets / Drive.

## 9. Автозапуск

Самый простой вариант — создать cron в Supabase Dashboard:

```text
Database → Cron → Create job
```

Запускать каждые 5 минут HTTP POST на:

```text
https://YOUR_PROJECT_REF.functions.supabase.co/process-google-sync
```

Header:

```text
Authorization: Bearer YOUR_SYNC_SECRET
```

Если Cron в твоём тарифе недоступен, можно временно запускать вручную через curl.
