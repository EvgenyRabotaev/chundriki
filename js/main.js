import { getMembers, getVideos } from './data.js';
import { parseVideoUrl, embedSrc, thumbnail, PLATFORM_LABEL } from './video.js';
import { esc, fmtDate, fmtMonth, toast, copyText, ROLE_CLASS } from './util.js';

// ---------- Состав ----------
let members = [];
let roleFilter = '';
let expanded = false;
const previewLimit = () => (window.innerWidth <= 600 ? 6 : 9);
const listEl = document.getElementById('roster-list');
const searchEl = document.getElementById('roster-search');

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
  const when = fmtMonth(b.awarded_at);
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
  const filtering = !!(q || roleFilter);
  const limit = previewLimit();
  const shown = (filtering || expanded) ? rows : rows.slice(0, limit);
  const toggle = (!filtering && rows.length > limit)
    ? `<div class="roster-more"><button class="btn btn-ghost" id="roster-toggle">${expanded ? 'Свернуть' : `Показать всех (${rows.length})`}</button></div>`
    : '';
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
  if (e.target.closest('#roster-toggle')) {
    expanded = !expanded;
    renderRoster();
    if (!expanded) document.getElementById('roster').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  const b = e.target.closest('.copy-btn');
  if (!b) return;
  await copyText(b.dataset.copy);
  toast(`Ник «${b.dataset.copy}» скопирован`);
});
searchEl.addEventListener('input', renderRoster);
document.querySelector('.role-filter').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  document.querySelectorAll('.role-filter .chip').forEach((c) => c.classList.toggle('active', c === b));
  roleFilter = b.dataset.role;
  renderRoster();
});

getMembers().then((rows) => {
  members = rows;
  document.getElementById('squad-count').textContent = rows.length;
  renderRoster();
}).catch((err) => {
  console.error(err);
  listEl.innerHTML = '<p class="error-text">Не удалось загрузить состав. Попробуйте обновить страницу.</p>';
});

// ---------- Видео ----------
const videoEl = document.getElementById('video-list');

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

getVideos().then(renderVideos).catch((err) => {
  console.error(err);
  videoEl.innerHTML = '<p class="error-text">Не удалось загрузить видео.</p>';
});
