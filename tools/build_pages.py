#!/usr/bin/env python3
"""Генератор статических страниц: общие head/шапка/подвал, SEO-теги на каждую страницу.
Запуск из корня репозитория: python3 tools/build_pages.py
Исходные фрагменты (hero и история) лежат в tools/fragments/."""
import pathlib, html
ROOT = pathlib.Path(__file__).resolve().parent.parent
FR = ROOT / 'tools' / 'fragments'
BASE = 'https://chundriki.top/'
V = '36'
NAV = [('index.html', 'Главная'), ('news.html', 'Новости'), ('roster.html', 'Состав'),
       ('moments.html', 'Моменты'), ('hall.html', 'Зал славы'), ('about.html', 'О клане')]
OG_IMG = BASE + 'assets/hero-bg-1280.webp'

def frag(n): return (FR / n).read_text(encoding='utf-8')

def page(file, title, desc, body, active, extra_head='', body_class='subpage', scripts=''):
    canon = BASE + ('' if file == 'index.html' else file)
    t = html.escape(title, quote=True); d = html.escape(desc, quote=True)
    nav = ''.join(f'<a href="{h}"{" class=\"active\" aria-current=\"page\"" if h == active else ""}>{n}</a>' for h, n in NAV)
    out = f'''<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{t}</title>
  <meta name="description" content="{d}">
  <meta name="theme-color" content="#16181a">
  <link rel="canonical" href="{canon}">
  <link rel="icon" href="favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">
  <link rel="apple-touch-icon" href="assets/favicon-180.png">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Chundriki">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:url" content="{canon}">
  <meta property="og:title" content="{t}">
  <meta property="og:description" content="{d}">
  <meta property="og:image" content="{OG_IMG}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Rubik:wght@400;500;700;900&display=swap" rel="stylesheet">
{extra_head}  <link rel="stylesheet" href="css/style.css?v=1{V}">
</head>
<body class="{body_class}" data-page="{file[:-5]}">
  <header class="topbar">
    <a class="brand" href="index.html"><img src="assets/favicon-32.png" alt="" width="28" height="28"> CHUNDRIKI</a>
    <button class="burger" id="burger" aria-label="Меню" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span></button>
    <nav id="site-nav">{nav}<div class="auth-box" id="auth-box"></div></nav>
  </header>
{body}
  <footer class="footer">
    <img src="assets/favicon-32.png" alt="" width="24" height="24">
    <span>© Chundriki · PUBG клан</span>
    <a href="admin.html" class="footer-admin">Вход для админов</a>
  </footer>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
{scripts}  <script type="module" src="js/main.js?v={V}"></script>
</body>
</html>
'''
    (ROOT / file).write_text(out, encoding='utf-8')

def head(kicker, h1, lead=''):
    return f'<div class="section-head page-head"><span class="kicker">{kicker}</span><h1>{h1}</h1>{f"<p class=\"page-lead\">{lead}</p>" if lead else ""}</div>'

def link_all(href, text='Смотреть все →'):
    return f'<a class="view-all" href="{href}">{text}</a>'

def pv(kicker, h2, href, inner, sid, linktext='Смотреть все →'):
    return f'''    <section class="section" id="{sid}">
      <div class="section-head split"><div><span class="kicker">{kicker}</span><h2>{h2}</h2></div>{link_all(href, linktext)}</div>
{inner}
    </section>
'''

AD_INTRO = '🐾Мы не просто клан в PUBG, мы - F4M (Family).  А в нашей семье ценят не твой средний урон, а то, какой ты человек. Если ты ищешь место, где можно быть собой, то добро пожаловать!🐾'
AD_FINAL = '🐾 Готов стать Чундриком? Пиши в ЛС, заходи в Дискорд и готовься к самым ярким (во всех смыслах, спасибо флешкам) каткам в твоей жизни!🐾'

def ad_full(): return f'''<article class="ad prose">
  <h2 class="ad-title">{AD_INTRO}</h2>
  <h3>Наш «профессиональный» геймплей:</h3>
  <ul class="ad-list">
    <li><b>🎒 Домашний уют:</b> Мы лутаемся в Починках так тщательно, будто выбираем мебель в Икее, поэтому даже если синяя зона уже жарит пятки, мы всё равно обчистим все туалеты на краю карты ради последнего бинта. Зона для нас - лишь декорация, пока в дальнем сарае всё ещё ждет своего часа «тот самый» глушитель.</li>
    <li><b>🏎 Семейные выезды:</b> Забудь про стрельбу и скучный «Топ-1»: если есть УАЗик и хоть какая-то поверхность, мы жмём на газ ради безумной гонки, где эффектный переворот на пути к финишу - наша самая священная традиция!</li>
    <li><b>💥 Флешка - лучший подарок:</b> Если друг кинул тебе флешку в лицо - значит, он тебя любит. У нас такая форма близости!</li>
    <li><b>🚀 Панцерфауст - аргумент любви:</b> В других кланах боятся ракет, а у нас запуск «шайтан-трубы» в спину соклана - это настоящая семейная близость и пламенный обряд посвящения! Если ты выжил после прямого попадания от своего - поздравляем, ты принят в семью!</li>
  </ul>
  <h3>Наши правила (простые, как выстрел из дробовика):</h3>
  <ol class="ad-rules">
    <li><b>🔞 Возраст 18+:</b> Мы ценим взрослое общение, но если ты адекватный, позитивный и тащишь на себе юмор (даже если тебе меньше) - сделаем исключение!</li>
    <li><b>🎧 Дискорд - наш дом:</b> Обязательно сидеть на сервере Чундриков. Мы здесь не только ради меток на карте, но и ради душевного (и не очень) общения.</li>
    <li><b>🎮 Свобода выбора:</b> Мы понимаем, что PUBG это не вся жизнь. Перегорел? Хочешь взять паузу или позвать всех в другую игру? Просто напиши в чат! Семья всегда поддержит твой выбор, и мы с радостью пойдем покорять другие миры вместе.</li>
  </ol>
  <h2 class="ad-final">{AD_FINAL}</h2>
  <div class="join-cta join-big"><a class="btn btn-discord" id="discord-join" href="#">Вступить в Discord</a><span class="join-note" id="discord-note" hidden>Ссылка на сервер появится скоро 🐾</span></div>
</article>'''

def recruit_teaser(): return f'''      <div class="recruit">
        <h3>{AD_INTRO}</h3>
        <p class="recruit-final">{AD_FINAL}</p>
        <div class="join-cta"><a class="btn btn-pink" href="about.html#join">Условия вступления</a><span data-discord-cta></span></div>
      </div>'''

hero = frag('hero.html')
history = frag('history.html')

# ---------- index ----------
preload = '''  <link rel="preload" as="image" href="assets/hero-bg-3840.webp" media="(min-width: 1921px), (min-width: 901px) and (min-resolution: 1.5dppx)">
  <link rel="preload" as="image" href="assets/hero-bg-1920.webp" media="(min-width: 901px) and (max-width: 1920px) and (max-resolution: 1.49dppx)">
  <link rel="preload" as="image" href="assets/hero-bg-1280.webp" media="(max-width: 900px)">
'''
idx = hero + '''
  <main>
''' + pv('// сводки', 'Новости', 'news.html', '      <div id="news-list" class="news-grid" data-limit="3"><p class="muted">Загружаем новости…</p></div>', 'news') \
  + pv('// сквад', 'Состав', 'roster.html', '''      <p class="roster-count muted">В клане сейчас: <b class="squad-count">…</b></p>
      <div id="roster-list" class="roster" data-teaser="1" data-limit="9"><p class="muted">Загружаем состав…</p></div>
      <div class="roster-more"><a class="btn btn-ghost" href="roster.html">Смотреть весь состав</a></div>''', 'roster', 'Весь состав →') \
  + pv('// килкам', 'Лучшие моменты', 'moments.html', '      <div id="video-list" class="videos" data-limit="3"><p class="muted">Загружаем видео…</p></div>', 'videos') \
  + '''  </main>
'''
page('index.html', 'Chundriki — PUBG клан', 'Клан Chundriki в PUBG: новости игры, состав, лучшие моменты и зал славы. Мы — F4M (Family).', idx, 'index.html', preload, 'home', '  <script src="js/hero.js" defer></script>\n')

# ---------- news ----------
page('news.html', 'Новости PUBG и клана — Chundriki', 'Свежие новости PUBG: BATTLEGROUNDS на русском: патчи, магазин, события и новости клана Chundriki.',
  '<main>\n    <section class="section" id="news">\n      ' + head('// сводки', 'Новости', 'Что нового в PUBG и в нашем клане.') +
  '\n      <div id="news-list" class="news-grid"><p class="muted">Загружаем новости…</p></div>\n      <article id="news-detail" class="news-detail" hidden></article>\n    </section>\n  </main>', 'news.html')

# ---------- roster ----------
page('roster.html', 'Состав клана — Chundriki', 'Полный состав клана Chundriki в PUBG: ники, роли, Discord и значки Чундриков.',
  '''<main>
    <section class="section" id="roster">
      ''' + head('// сквад', 'Состав', 'Все Чундрики клана: поиск по нику, фильтр по роли.') + '''
      <div class="roster-tools">
        <input type="search" id="roster-search" placeholder="Поиск по нику или имени…" aria-label="Поиск по составу">
        <div class="role-filter" role="group" aria-label="Фильтр по роли">
          <button class="chip active" data-role="">Все</button>
          <button class="chip" data-role="глава">Глава</button>
          <button class="chip" data-role="руководитель">Руководители</button>
          <button class="chip" data-role="чундрик">Чундрики</button>
        </div>
      </div>
      <p class="roster-count muted">Всего в клане: <b class="squad-count">…</b></p>
      <div id="roster-list" class="roster"><p class="muted">Загружаем состав…</p></div>
    </section>
  </main>''', 'roster.html')

# ---------- moments ----------
page('moments.html', 'Лучшие моменты — Chundriki', 'Лучшие моменты клана Chundriki в PUBG: переворот УАЗика, флешки и панцерфаусты в видео.',
  '<main>\n    <section class="section" id="videos">\n      ' + head('// килкам', 'Лучшие моменты', 'Нарезки из наших катков.') +
  '\n      <div id="video-list" class="videos"><p class="muted">Загружаем видео…</p></div>\n    </section>\n  </main>', 'moments.html')

# ---------- hall ----------
page('hall.html', 'Зал славы — Chundriki', 'Зал славы клана Chundriki: значки, награды и те, кто их заслужил.',
  '<main>\n    <section class="section" id="hall">\n      ' + head('// награды', 'Зал славы', 'Значки клана и те, кто их заслужил. Победители голосований появятся здесь позже.') +
  '\n      <div id="hall-list" class="hall"><p class="muted">Загружаем значки…</p></div>\n    </section>\n  </main>', 'hall.html')

# ---------- about ----------
page('about.html', 'О клане — Chundriki', 'История клана Chundriki, наши правила и как вступить в семью F4M в PUBG.',
  '<main>\n' + history + '''
    <section class="section" id="join">
      <div class="section-head"><span class="kicker">// вербовка</span><h2>Вступить в клан</h2></div>
      ''' + ad_full() + '''
    </section>
  </main>''', 'about.html')

# ---- robots.txt и sitemap.xml ----
import re, json, urllib.request
(ROOT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /admin.html\n\nSitemap: {BASE}sitemap.xml\n', encoding='utf-8')
urls = [BASE if h == 'index.html' else BASE + h for h, _ in NAV]
try:
    cfg = (ROOT / 'js' / 'config.js').read_text(encoding='utf-8')
    su = re.search(r"SUPABASE_URL\s*=\s*['\"]([^'\"]+)", cfg).group(1); sk = re.search(r"SUPABASE_ANON_KEY\s*=\s*['\"]([^'\"]+)", cfg).group(1)
    rq = urllib.request.Request(su + '/rest/v1/news?select=id&order=id', headers={'apikey': sk, 'Authorization': 'Bearer ' + sk})
    urls += [f'{BASE}news.html?id={r["id"]}' for r in json.load(urllib.request.urlopen(rq, timeout=15))]
except Exception as e:
    print('sitemap: без новостей:', e)
(ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{html.escape(u)}</loc></url>\n' for u in urls) + '</urlset>\n', encoding='utf-8')
print('ok')
