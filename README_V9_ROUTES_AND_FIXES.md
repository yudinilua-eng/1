# v9 — исправление меню, ошибок Supabase и многостраничные URL

## Что изменено

1. Убрано пустое окно/пустые раскрытые блоки в боковом меню.
2. Исправлена ошибка `window.supabaseClient.rpc(...).catch is not a function`.
3. Исправлены частые ошибки `Cannot read properties of null (reading 'value')` в формах.
4. Создание аккаунтов учеников переведено на RPC-функции Supabase, чтобы не ловить RLS-ошибку `student_credentials`.
5. Добавлены нормальные URL-страницы вместо `#/teacherStudents`:
   - `/teacher/students`
   - `/teacher/materials`
   - `/teacher/homework`
   - `/teacher/schedule`
   - `/teacher/finance`
   - `/student`
   - `/booking`
   - `/cases`
   - `/reviews`
6. Добавлен `vercel.json`, чтобы прямое открытие этих URL на Vercel не давало 404.

## Что сделать после загрузки в GitHub

1. Заменить `index.html`.
2. Добавить `vercel.json`.
3. Выполнить в Supabase SQL Editor файл:

```text
supabase_student_login_routes_v9.sql
```

4. Убедиться, что у вашего преподавательского профиля в таблице `profiles` стоит:

```text
role = admin
```

или

```text
role = teacher
```

5. Дождаться деплоя Vercel и открыть сайт через `Cmd + Shift + R` / `Ctrl + Shift + R`.

## Проверка

- Откройте `/teacher/students` напрямую в браузере.
- Создайте ученика с логином и паролем.
- Выйдите и зайдите как ученик через `/login`.
- Проверьте, что после обновления страницы URL и раздел сохраняются.
