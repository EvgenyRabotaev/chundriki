// Раздел «Видео»: плеер YouTube (nocookie), кнопки «Открыть на YouTube» / «Смотреть в TikTok», плашки участников.
import { getClips, getMembers } from './data.js?v=41';
import { esc, fmtLong, safeUrl } from './util.js?v=33';

const el = document.getElementById('clip-list');
if (el) {
  const card = (v, nicks) => {
    const yt = v.youtube_id;
    const embed = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt || '')}?rel=0&playsinline=1`;
    const tt = safeUrl(v.tiktok_url);
    const media = yt
      ? `<div class="clip-player ${v.is_short ? 'vertical' : ''}"><iframe src="${esc(embed)}" title="${esc(v.title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
      : `<div class="clip-player clip-ph"><span>🎬</span><b>${esc(v.title)}</b></div>`;
    const btns = [
      yt ? `<a class="btn btn-yt" href="https://youtu.be/${esc(yt)}" target="_blank" rel="noopener">▶ Открыть на YouTube</a>` : '',
      tt ? `<a class="btn btn-tt" href="${esc(tt)}" target="_blank" rel="noopener">♪ Смотреть в TikTok</a>` : '',
    ].join('');
    const chips = nicks.length
      ? `<div class="clip-members"><span class="lbl">В кадре:</span>${nicks.map((m) => `<a class="chip clip-chip" href="roster.html#m${m.id}">${esc(m.game_nick)}</a>`).join('')}</div>` : '';
    return `<article class="clip">${media}
      <div class="clip-body">
        <time class="muted" datetime="${esc(v.published_at)}">${esc(fmtLong(v.published_at))}</time>
        <h3>${esc(v.title)}</h3>
        ${v.description ? `<p class="short">${esc(v.description)}</p>` : ''}
        ${chips}
        <div class="clip-btns">${btns}</div>
      </div></article>`;
  };
  Promise.all([getClips(), getMembers().catch(() => [])]).then(([clips, members]) => {
    if (!clips.length) { el.innerHTML = '<p class="muted clip-empty">🎬 Пока тут пусто: оператор ещё ищет, где в этом клане пленка без лагов. Скоро будет кино.</p>'; return; }
    const byId = new Map(members.map((m) => [m.id, m]));
    el.innerHTML = clips.map((v) => card(v, (v.clan_video_members || []).map((x) => byId.get(x.member_id)).filter(Boolean))).join('');
  }).catch((err) => { console.error(err); el.innerHTML = '<p class="error-text">Не удалось загрузить видео.</p>'; });
}
