# Chundriki — сайт PUBG-клана

Статический сайт (HTML/CSS/JS) на GitHub Pages, данные в Supabase.

- Страницы: `index.html` (витрина: hero и превью разделов), `news.html` (новости, `?id=N` — полная новость), `roster.html` (состав), `moments.html` (видео), `hall.html` (Зал славы), `about.html` (история, правила, вступление).
- Страницы собираются скриптом `python3 tools/build_pages.py` (общая шапка, подвал и SEO-теги; фрагменты hero и истории в `tools/fragments/`). После правки шаблона запустите его и закоммитьте результат.
- Ссылка-приглашение в Discord: `DISCORD_INVITE` в `js/config.js` (пока пусто, кнопка скрыта).
- `admin.html` — админка (вход по ссылке на почту, только для админов).
- `js/data.js` — весь доступ к данным в одном месте (можно заменить бэкенд).
- `js/config.js` — URL проекта и публичный anon-ключ (безопасность обеспечивают RLS-политики в базе).

Сайт: https://evgenyrabotaev.github.io/chundriki/
