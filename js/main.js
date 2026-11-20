import { getMembers, getVideos, getNews, getNewsItem, getBadges, signInDiscord, signOut, getSession, onAuthChange, isAdmin, getComments, addComment, deleteComment, isChundrik } from './data.js?v=26';
import { DISCORD_INVITE } from './config.js';
import { parseVideoUrl, embedSrc, thumbnail, PLATFORM_LABEL } from './video.js';
import { esc, fmtDate, fmtMonth, fmtLong, renderRich, safeUrl, toast, copyText, ROLE_CLASS } from './util.js';

// ---------- Состав ----------
let members = [];
let roleFilter = '';
const listEl = document.getElementById('roster-list') || document.createElement('div');
const searchEl = document.getElementById('roster-search') || { value: '', addEventListener() {} };
const teaser = !!listEl.dataset.teaser;

function discordCell(m) {
  const nick = esc(m.discord_nick || '—');
  if (!m.discord_nick) return '<span class="muted">—</span>';
  if (m.discord_id) {
    return `<a class="discord-link" href="https://discord.com/users/${esc(m.discord_id)}" target="_blank" rel="noopener" title="${nick} — открыть профиль в Discord">${discordIcon()}<span class="trunc">${nick}</span></a>`;
  }
  return `<span class="discord-nick" title="${nick}">${discordIcon()}<span class="trunc">${nick}</span></span>
    <button class="copy-btn" data-copy="${esc(m.discord_nick)}" title="Скопировать ник" aria-label="Скопировать ник ${nick}"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg></button>`;
}
function discordIcon() {
  return '<svg class="dc-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.5 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.8 19.8 0 0 0 6 3l1.3-2a12.7 12.7 0 0 1-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4-2 1 1.3 2a19.7 19.7 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.7ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>';
}

const BADGE_MAX = 8;
function badgeIcon(b) {
  const inner = b.icon_url
    ? `<img src="${esc(b.icon_url)}" alt="" loading="lazy" width="32" height="32">`
    : `<span class="badge-emoji" aria-hidden="true">${esc(b.emoji || '🏅')}</span>`;
  return `<button type="button" class="badge" data-badge="${b.id}" aria-label="Значок: ${esc(b.title)}">${inner}</button>`;
}
function badgesRow(m) {
  const list = m.badges || [];
  if (!list.length) return '';
  const open = openBadges.has(m.id);
  const vis = (list.length > BADGE_MAX && !open) ? list.slice(0, BADGE_MAX - 1) : list;
  const more = (list.length > BADGE_MAX && !open) ? `<button type="button" class="badge badge-more" data-more="${m.id}" aria-label="Показать ещё значки: ${list.length - vis.length}">+${list.length - vis.length}</button>` : '';
  return `<div class="member-badges">${vis.map(badgeIcon).join('')}${more}</div>`;
}
const openBadges = new Set();
const badgeById = (mid, bid) => (members.find((x) => x.id == mid)?.badges || []).find((b) => b.id == bid);

// Одна общая подсказка поверх страницы (карточки с overflow:hidden её не обрежут)
const tip = document.createElement('div');
tip.className = 'badge-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
document.body.appendChild(tip);
let tipFor = null;
function showTip(btn) {
  const card = btn.closest('.member');
  const b = badgeById(card?.dataset.id, btn.dataset.badge);
  if (!b) return;
  const when = b.awarded_label || fmtMonth(b.awarded_at);
  tip.innerHTML = `<b>${esc((b.emoji && !b.icon_url ? b.emoji + ' ' : '') + b.title)}</b>${b.description ? `<span>${esc(b.description)}</span>` : ''}${b.note ? `<span>${esc(b.note)}</span>` : ''}${when ? `<em>${esc(when)}</em>` : ''}`;
  tip.hidden = false; tipFor = btn;
  const r = btn.getBoundingClientRect(), t = tip.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2));
  const above = r.top - t.height - 8 >= 8;
  tip.style.left = left + 'px';
  tip.style.top = (above ? r.top - t.height - 8 : r.bottom + 8) + 'px';
}
function hideTip() { tip.hidden = true; tipFor = null; }
const canHover = window.matchMedia('(hover: hover)').matches;
listEl.addEventListener('mouseover', (e) => { if (!canHover) return; const b = e.target.closest('.badge[data-badge]'); if (b) showTip(b); });
listEl.addEventListener('mouseout', (e) => { if (!canHover) return; if (e.target.closest('.badge[data-badge]')) hideTip(); });
listEl.addEventListener('click', (e) => { const b = e.target.closest('.badge[data-badge]'); if (b) showTip(b); });
listEl.addEventListener('focusin', (e) => { const b = e.target.closest('.badge[data-badge]'); if (b) showTip(b); });
listEl.addEventListener('focusout', () => { if (canHover) hideTip(); });
document.addEventListener('click', (e) => { if (tipFor && !e.target.closest('.badge[data-badge]')) hideTip(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
window.addEventListener('scroll', hideTip, { passive: true });

function renderRoster() {
  hideTip();
  const q = searchEl.value.trim().toLowerCase();
  const rows = members.filter((m) =>
    (!roleFilter || m.clan_role === roleFilter) &&
    (!q || [m.game_nick, m.discord_nick, m.real_name].some((v) => String(v || '').toLowerCase().includes(q))));
  if (!rows.length) { listEl.innerHTML = '<p class="muted">Никого не нашли. Может, он в кустах?</p>'; return; }
  const shown = teaser ? rows.slice(0, +listEl.dataset.limit || 9) : rows;
  const toggle = '';
  listEl.innerHTML = shown.map((m) => `
    <article class="member ${ROLE_CLASS[m.clan_role] || ''}" data-id="${m.id}">
      <div class="member-top">
        <h3 class="nick" title="${esc(m.game_nick)}">${esc(m.game_nick)}</h3>
        <span class="role ${ROLE_CLASS[m.clan_role] || ''}">${esc(m.clan_role || '—')}</span>
      </div>
      <div class="member-row"><span class="lbl">Discord</span><span class="val">${discordCell(m)}</span></div>
      <div class="member-row"><span class="lbl">Имя</span><span class="val">${esc(m.real_name || '—')}</span></div>
      <div class="member-row"><span class="lbl">В клане с</span><span class="val">${fmtDate(m.joined_at)}</span></div>
      ${badgesRow(m)}
    </article>`).join('') + toggle;
}

listEl.addEventListener('click', async (e) => {
  const more = e.target.closest('[data-more]');
  if (more) { openBadges.add(+more.dataset.more); renderRoster(); return; }
  const b = e.target.closest('.copy-btn');
  if (!b) return;
  await copyText(b.dataset.copy);
  toast(`Ник «${b.dataset.copy}» скопирован`);
});
searchEl.addEventListener('input', renderRoster);
document.querySelector('.role-filter')?.addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  document.querySelectorAll('.role-filter .chip').forEach((c) => c.classList.toggle('active', c === b));
  roleFilter = b.dataset.role;
  renderRoster();
});

const needMembers = ['roster-list', 'hall-list'].some((id) => document.getElementById(id));
if (needMembers) getMembers().then((rows) => {
  members = rows;
  document.querySelectorAll('.squad-count').forEach((el) => { el.textContent = rows.length; });
  renderRoster();
  renderHall();
}).catch((err) => {
  console.error(err);
  listEl.innerHTML = '<p class="error-text">Не удалось загрузить состав. Попробуйте обновить страницу.</p>';
  const h = document.getElementById('hall-list'); if (h) h.innerHTML = '<p class="error-text">Не удалось загрузить данные.</p>';
});

// ---------- Видео ----------
const videoEl = document.getElementById('video-list') || document.createElement('div');

function renderVideos(videos) {
  if (!videos.length) { videoEl.innerHTML = '<p class="muted">Скоро здесь появятся наши лучшие моменты.</p>'; return; }
  videoEl.innerHTML = videos.map((v) => {
    const { platform } = parseVideoUrl(v.url);
    const src = embedSrc(v.url);
    const thumb = thumbnail(v.url);
    const isVertical = platform === 'tiktok';
    const media = src
      ? `<button class="player ${isVertical ? 'vertical' : ''}" data-src="${esc(src)}" aria-label="Смотреть: ${esc(v.title)}">
           ${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : `<span class="player-ph">${esc(PLATFORM_LABEL[platform])}</span>`}
           <span class="play">▶</span>
         </button>`
      : `<a class="player link-only" href="${esc(v.url)}" target="_blank" rel="noopener"><span class="player-ph">Открыть видео ↗</span></a>`;
    return `
      <article class="video">
        ${media}
        <div class="video-body">
          <div class="video-meta"><span class="platform p-${platform}">${esc(PLATFORM_LABEL[platform])}</span>
            <a class="ext" href="${esc(v.url)}" target="_blank" rel="noopener">оригинал ↗</a></div>
          <h3>${esc(v.title)}</h3>
          ${v.short_desc ? `<p class="short">${esc(v.short_desc)}</p>` : ''}
          ${v.long_desc ? `<details class="more"><summary>Подробнее</summary><p>${esc(v.long_desc)}</p></details>` : ''}
        </div>
      </article>`;
  }).join('');
}

videoEl.addEventListener('click', (e) => {
  const p = e.target.closest('button.player');
  if (!p) return;
  const iframe = document.createElement('iframe');
  iframe.src = p.dataset.src;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  const wrap = document.createElement('div');
  wrap.className = 'player playing' + (p.classList.contains('vertical') ? ' vertical' : '');
  wrap.appendChild(iframe);
  p.replaceWith(wrap);
});

if (document.getElementById('video-list')) getVideos().then((v) => renderVideos(videoEl.dataset.limit ? v.slice(0, +videoEl.dataset.limit) : v)).catch((err) => {
  console.error(err);
  videoEl.innerHTML = '<p class="error-text">Не удалось загрузить видео.</p>';
});

// ---------- Новости ----------
const newsEl = document.getElementById('news-list');
const detailEl = document.getElementById('news-detail');
const newsHref = (id) => `news.html?id=${id}`;
const PLACEHOLDER_IMG = 'assets/hero-bg-1280.webp';

function excerpt(body, n = 170) {
  const t = String(body || '').replace(/[#*>\[\]]|\(https?:[^)]*\)/g, '').replace(/^\s*[-•]\s+/gm, '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
}
function newsCard(n) {
  const img = safeUrl(n.image_url);
  return `<a class="news-card ${n.pinned ? 'pinned' : ''}" href="${newsHref(n.id)}">
    <div class="news-img ${img ? '' : 'ph'}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span>PUBG</span>'}${n.pinned ? '<span class="pin">📌 Закреплено</span>' : ''}</div>
    <div class="news-body"><time datetime="${esc(n.published_at)}">${esc(fmtLong(n.published_at))}</time>
      <h3>${esc(n.title)}</h3><p>${esc(excerpt(n.body))}</p></div></a>`;
}
function renderNewsDetail(n) {
  const img = safeUrl(n.image_url), src = safeUrl(n.source_url);
  document.title = `${n.title} — Chundriki`;
  detailEl.innerHTML = `<a class="back-link" href="news.html">← Все новости</a>${n.status === 'draft' ? '<p class="draft-banner">📝 Черновик — ещё не опубликован, на сайте и в Telegram его не видно</p>' : ''}
    <time datetime="${esc(n.published_at)}">${esc(fmtLong(n.published_at))}</time>
    <h2 class="news-title">${esc(n.title)}</h2>
    ${img ? `<figure class="news-fig news-cover"><img src="${esc(img)}" alt="${esc(n.title)}">${img.startsWith('assets/news/') ? '<figcaption>Изображения: © KRAFTON / PUBG</figcaption>' : ''}</figure>` : ''}
    <div class="prose">${renderRich(n.body)}</div>
    ${src ? `<p class="news-source">Источник: <a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${esc(n.source_name || src)} ↗</a></p>` : ''}
    <section class="comments" id="comments"></section>`;
  initComments(n.id);
}

// ---------- Комментарии ----------
function fmtDateTimeMsk(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(dt) + ' МСК';
}
function initComments(newsId) {
  const box = document.getElementById('comments');
  if (!box) return;
  let comments = [], session = null, canPost = false, admin = false, draft = '';
  const draw = () => {
    const uid = session?.user?.id;
    const list = comments.length ? comments.map((c) => {
      const ava = safeUrl(c.author_avatar || '');
      const del = (uid && (c.user_id === uid || admin)) ? `<button type="button" class="c-del" data-id="${c.id}" title="Удалить" aria-label="Удалить комментарий">×</button>` : '';
      return `<div class="c-item">${ava ? `<img class="c-ava" src="${esc(ava)}" alt="" width="36" height="36" loading="lazy" referrerpolicy="no-referrer">` : '<span class="c-ava ph"></span>'}
        <div class="c-main"><div class="c-head"><b class="c-name">${esc(c.author_name || 'Игрок')}</b><time>${esc(fmtDateTimeMsk(c.created_at))}</time>${del}</div>
        <div class="c-body">${esc(c.body).replace(/\n/g, '<br>')}</div></div></div>`;
    }).join('') : '<p class="muted">Пока никто не написал. Будь первым!</p>';
    let form;
    if (!session) form = '<div class="c-note"><span>Войдите через Discord, чтобы комментировать</span><button type="button" class="auth-login c-login">Войти</button></div>';
    else if (!canPost) form = '<p class="c-note muted">Комментировать могут только участники клана с ролью «Чундрики» в Discord.</p>';
    else form = `<form class="c-form"><textarea maxlength="1000" rows="3" placeholder="Ваш комментарий…" required>${esc(draft)}</textarea><div class="c-actions"><span class="c-count">${draft.length}/1000</span><button type="submit" class="btn">Отправить</button></div></form>`;
    box.innerHTML = `<h3>Комментарии (${comments.length})</h3><div class="c-list">${list}</div>${form}`;
    const ta = box.querySelector('textarea');
    if (ta) ta.addEventListener('input', () => { draft = ta.value; box.querySelector('.c-count').textContent = `${draft.length}/1000`; });
  };
  box.addEventListener('click', async (e) => {
    if (e.target.closest('.c-login')) {
      try { await signInDiscord(location.origin + location.pathname + location.search); } catch (err) { toast('Не удалось начать вход: ' + err.message, true); }
      return;
    }
    const del = e.target.closest('.c-del');
    if (del && confirm('Удалить комментарий?')) {
      try { await deleteComment(del.dataset.id); comments = comments.filter((c) => String(c.id) !== del.dataset.id); draw(); }
      catch (err) { toast(err.message, true); }
    }
  });
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = box.querySelector('.c-form button[type=submit]');
    const text = draft.trim();
    if (!text) return;
    btn.disabled = true;
    try { comments.push(await addComment(newsId, text)); draft = ''; draw(); }
    catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  const loadUser = async (s) => {
    session = s; canPost = false; admin = false;
    if (s) { try { [canPost, admin] = await Promise.all([isChundrik(), isAdmin()]); } catch {} }
    draw();
  };
  draw();
  getComments(newsId).then((r) => { comments = r; draw(); }).catch((err) => { console.error(err); box.innerHTML = '<p class="error-text">Не удалось загрузить комментарии.</p>'; });
  getSession().then(loadUser).catch(() => loadUser(null));
  onAuthChange((s) => { if ((s?.user?.id) !== (session?.user?.id)) setTimeout(() => loadUser(s), 0); });
}
if (newsEl) {
  const qs = new URLSearchParams(location.search);
  const id = qs.get('id');
  if (id && detailEl) {
    newsEl.hidden = true;
    getNewsItem(id, qs.get('preview')).then((n) => {
      if (!n) { detailEl.innerHTML = '<a class="back-link" href="news.html">← Все новости</a><p class="muted">Такой новости нет.</p>'; }
      else renderNewsDetail(n);
      detailEl.hidden = false;
      document.querySelector('.page-head')?.setAttribute('hidden', '');
    }).catch((err) => { console.error(err); detailEl.hidden = false; detailEl.innerHTML = '<p class="error-text">Не удалось загрузить новость.</p>'; });
  } else {
    getNews(+newsEl.dataset.limit || undefined).then((rows) => {
      newsEl.innerHTML = rows.length ? rows.map(newsCard).join('') : '<p class="muted">Новостей пока нет.</p>';
    }).catch((err) => { console.error(err); newsEl.innerHTML = '<p class="error-text">Не удалось загрузить новости.</p>'; });
  }
}

// ---------- Зал славы ----------
const hallEl = document.getElementById('hall-list');
let allBadges = null;
if (hallEl) getBadges().then((b) => { allBadges = b; renderHall(); }).catch((err) => { console.error(err); hallEl.innerHTML = '<p class="error-text">Не удалось загрузить значки.</p>'; });
function renderHall() {
  if (!hallEl || !allBadges || !members.length) return;
  if (!allBadges.length) { hallEl.innerHTML = '<p class="muted">Значков пока нет.</p>'; return; }
  hallEl.innerHTML = allBadges.map((b) => {
    const holders = members.flatMap((m) => (m.badges || []).filter((x) => x.id === b.id).map((x) => ({ m, x })))
      .sort((a, c) => String(a.x.awarded_at || '').localeCompare(String(c.x.awarded_at || '')));
    const icon = b.icon_url ? `<img src="${esc(b.icon_url)}" alt="" width="72" height="72" loading="lazy">` : `<span class="hall-emoji">${esc(b.emoji || '🏅')}</span>`;
    return `<article class="hall-card"><div class="hall-icon">${icon}</div><div class="hall-info">
      <h3>${esc(b.title)}</h3>${b.description ? `<p>${esc(b.description)}</p>` : ''}
      <ul class="holders">${holders.length ? holders.map(({ m, x }) => `<li><b>${esc(m.game_nick)}</b>${(x.awarded_label || x.awarded_at) ? `<span>${esc(x.awarded_label || fmtMonth(x.awarded_at))}</span>` : ''}${x.note ? `<small>${esc(x.note)}</small>` : ''}</li>`).join('') : '<li class="muted">Пока никто не получил</li>'}</ul>
    </div></article>`;
  }).join('');
}

// ---------- Кнопка Discord (только если задана ссылка-приглашение) ----------
const joinBtn = document.getElementById('discord-join');
if (joinBtn) {
  if (DISCORD_INVITE) { joinBtn.href = DISCORD_INVITE; joinBtn.target = '_blank'; joinBtn.rel = 'noopener'; }
  else joinBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('discord-note').hidden = false; });
}

// ---------- Меню (бургер) ----------
const burger = document.getElementById('burger');
const topbar = document.querySelector('.topbar');
if (burger) {
  const setMenu = (open) => { topbar.classList.toggle('menu-open', open); burger.setAttribute('aria-expanded', String(open)); };
  burger.addEventListener('click', () => setMenu(!topbar.classList.contains('menu-open')));
  document.getElementById('site-nav').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.topbar')) setMenu(false); });
}

// ---------- Вход через Discord (для всех, без прав админа) ----------
const authBox = document.getElementById('auth-box');
if (authBox) {
  const ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M20.3 4.4A17.6 17.6 0 0 0 16 3l-.2.4c1.5.4 2.2.9 3 1.5a12 12 0 0 0-10 0c.8-.6 1.6-1.1 3.1-1.5L11.700 3a17.600 17.600 0 0 0-4.300 1.400C4.700 8.400 4 12.300 4.300 16.100a17.700 17.700 0 0 0 5.300 2.700l1.100-1.800c-.6-.2-1.200-.5-1.700-.9l.4-.3a12.600 12.600 0 0 0 10.800 0l.4.300c-.5.400-1.100.700-1.700.9l1.100 1.800a17.700 17.700 0 0 0 5.300-2.700c.4-4.400-.7-8.300-3-11.700ZM9.700 13.800c-1 0-1.800-.9-1.800-2s.8-2 1.800-2 1.800.9 1.800 2-.8 2-1.800 2Zm4.600 0c-1 0-1.800-.9-1.800-2s.8-2 1.800-2 1.800.9 1.800 2-.8 2-1.800 2Z"/></svg>';
  let renderSeq = 0;
  const render = async (session) => {
    const seq = ++renderSeq;
    if (!session) {
      authBox.innerHTML = `<button type="button" class="auth-login">${ICON}<span>Войти</span></button>`;
      authBox.querySelector('.auth-login').addEventListener('click', async () => {
        try { await signInDiscord(location.origin + location.pathname + location.search); }
        catch (e) { toast('Не удалось начать вход: ' + e.message, true); }
      });
      return;
    }
    const m = session.user?.user_metadata || {};
    const name = m.custom_claims?.global_name || m.full_name || m.name || 'Игрок';
    const avatar = safeUrl(m.avatar_url || '');
    authBox.innerHTML = `<span class="auth-user">${avatar ? `<img class="auth-ava" src="${esc(avatar)}" alt="" width="26" height="26" referrerpolicy="no-referrer">` : ''}<span class="auth-name">${esc(name)}</span></span><span class="auth-admin-slot"></span><button type="button" class="auth-logout" aria-label="Выйти" data-tip="Выйти"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg></button>`;
    authBox.querySelector('.auth-logout').addEventListener('click', async () => { try { await signOut(); } catch {} render(null); });
    try {
      if (await isAdmin() && seq === renderSeq) authBox.querySelector('.auth-admin-slot').innerHTML = '<a class="auth-admin" href="admin.html">Админка</a>';
    } catch {}
  };
  try { render(await getSession()); } catch { render(null); }
  onAuthChange((s) => { setTimeout(() => render(s), 0); });
}
