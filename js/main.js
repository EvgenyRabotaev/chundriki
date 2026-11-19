import { getMembers, getVideos } from './data.js';
import { parseVideoUrl, embedSrc, thumbnail, PLATFORM_LABEL } from './video.js';
import { esc, fmtDate, toast, copyText, ROLE_CLASS } from './util.js';

// ---------- Состав ----------
let members = [];
let roleFilter = '';
const listEl = document.getElementById('roster-list');
const searchEl = document.getElementById('roster-search');

function discordCell(m) {
  const nick = esc(m.discord_nick || '—');
  if (!m.discord_nick) return '<span class="muted">—</span>';
  if (m.discord_id) {
    return `<a class="discord-link" href="https://discord.com/users/${esc(m.discord_id)}" target="_blank" rel="noopener" title="Открыть профиль в Discord">${discordIcon()}${nick}</a>`;
  }
  return `<span class="discord-nick">${discordIcon()}${nick}</span>
    <button class="copy-btn" data-copy="${esc(m.discord_nick)}" title="Скопировать ник" aria-label="Скопировать ник ${nick}"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg></button>`;
}
function discordIcon() {
  return '<svg class="dc-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.5 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.8 19.8 0 0 0 6 3l1.3-2a12.7 12.7 0 0 1-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4-2 1 1.3 2a19.7 19.7 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.7ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>';
}

function renderRoster() {
  const q = searchEl.value.trim().toLowerCase();
  const rows = members.filter((m) =>
    (!roleFilter || m.clan_role === roleFilter) &&
    (!q || [m.game_nick, m.discord_nick, m.real_name].some((v) => String(v || '').toLowerCase().includes(q))));
  if (!rows.length) { listEl.innerHTML = '<p class="muted">Никого не нашли. Может, он в кустах?</p>'; return; }
  listEl.innerHTML = rows.map((m) => `
    <article class="member ${ROLE_CLASS[m.clan_role] || ''}">
      <div class="member-top">
        <h3 class="nick">${esc(m.game_nick)}</h3>
        <span class="role ${ROLE_CLASS[m.clan_role] || ''}">${esc(m.clan_role || '—')}</span>
      </div>
      <div class="member-row"><span class="lbl">Discord</span><span class="val">${discordCell(m)}</span></div>
      <div class="member-row"><span class="lbl">Имя</span><span class="val">${esc(m.real_name || '—')}</span></div>
      <div class="member-row"><span class="lbl">В клане с</span><span class="val">${fmtDate(m.joined_at)}</span></div>
    </article>`).join('');
}

listEl.addEventListener('click', async (e) => {
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
