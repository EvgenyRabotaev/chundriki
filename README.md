# Chundriki — сайт PUBG-клана

Статический сайт (HTML/CSS/JS) на GitHub Pages, данные в Supabase.

- Страницы: `index.html` (витрина: hero и превью разделов), `news.html` (новости, `?id=N` — полная новость), `roster.html` (состав), `moments.html` (видео), `hall.html` (Зал славы), `about.html` (история, правила, вступление).
- Страницы собираются скриптом `python3 tools/build_pages.py` (общая шапка, подвал и SEO-теги; фрагменты hero и истории в `tools/fragments/`). После правки шаблона запустите его и закоммитьте результат.
- Ссылка-приглашение в Discord: `DISCORD_INVITE` в `js/config.js` (пока пусто, кнопка скрыта).
- `admin.html` — админка (вход по ссылке на почту, только для админов).
- `js/data.js` — весь доступ к данным в одном месте (можно заменить бэкенд).
- `js/config.js` — URL проекта и публичный anon-ключ (безопасность обеспечивают RLS-политики в базе).

Сайт: https://chundriki.top/

## Discord-бот регистрации

Бот не работает круглосуточно: всё крутится в Supabase.

- `supabase/functions/discord-interactions` принимает нажатия кнопки «Указать ник» и форму «Анкета Чундрика» (проверка подписи Discord, адрес записан в приложении как Interactions Endpoint URL).
- `supabase/functions/discord-sync` запускается pg_cron каждые 5 минут (`select * from cron.job`). Если бот ещё не на сервере, отвечает `no guild`. Иначе: ищет роль «Чундрики» и канал с «регистрация» в названии, публикует и закрепляет сообщение с кнопкой, тегает новичков (только вошедших после установки бота), привязывает людей с ролью к записям на сайте (по `discord_id`, затем по Discord-нику или игровому нику), обновляет ники, переносит в «бывших» тех, у кого есть `discord_id` и снята роль или кто вышел. Записи без `discord_id` не удаляются, они попадают в таблицу `bot_sync_report`.
- Таблицы: `bot_config`, `discord_registrations`, `discord_pings`, `bot_sync_report` (миграция в `supabase/migrations`). RLS включён, доступ только у service_role.
- Секреты (токен бота, публичный ключ, `SYNC_SECRET`) лежат в Supabase Function Secrets, секрет для cron в vault (`discord_sync_secret`). В репозитории их нет.
- Деплой: `SUPABASE_ACCESS_TOKEN=… npx supabase functions deploy <имя> --remote=<ref> --use-api --no-verify-jwt --yes`.
- Приглашение бота: `https://discord.com/oauth2/authorize?client_id=1573098374339756193&permissions=93184&scope=bot%20applications.commands` (права: View Channels, Send Messages, Read Message History, Manage Messages, Embed Links).
