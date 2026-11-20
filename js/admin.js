import * as db from './data.js';
import { detectPlatform, PLATFORM_LABEL } from './video.js';
import { esc, fmtDate, fmtLong, toast } from './util.js';

const $ = (id) => document.getElementById(id);
const views = ['loading', 'login', 'denied', 'admin'];
function show(v) { views.forEach((x) => ($('view-' + x).hidden = x !== v)); }

const ROLES = ['глава', 'руководитель', 'чундрик'];
const LEAVE_TYPES = ['ушёл сам', 'выгнали'];
const today = () => new Date().toISOString().slice(0, 10);

// ---------- Авторизация ----------
let started = false;
async function route(session) {
  if (!session) { started = false; show('login'); return; }
  const who = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email;
  try {
    if (!(await db.isAdmin())) { $('denied-email').textContent = who; show('denied'); return; }
  } catch (e) { toast('Ошибка проверки доступа: ' + e.message, true); show('login'); return; }
  $('admin-email').textContent = who;
  show('admin');
  if (!started) { started = true; loadAll(); }
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter; btn.disabled = true;
  const msg = $('login-msg');
  try {
    const redirect = new URL('admin.html', location.href).href;
    await db.sendMagicLink($('login-email').value, redirect);
    msg.textContent = 'Готово! Проверьте почту и перейдите по ссылке из письма.';
  } catch (err) {
    msg.textContent = /signups not allowed|not found|otp_disabled/i.test(err.message)
      ? 'Этой почты нет среди админов.' : 'Ошибка: ' + err.message;
  } finally { btn.disabled = false; }
});
$('login-discord').addEventListener('click', async (e) => {
  e.currentTarget.disabled = true;
  try { await db.signInDiscord(new URL('admin.html', location.href).href); }
  catch (err) { $('login-msg').textContent = 'Ошибка: ' + err.message; e.currentTarget.disabled = false; }
});
for (const id of ['logout', 'denied-logout']) $(id).addEventListener('click', async () => { await db.signOut(); show('login'); });

db.onAuthChange((session) => route(session));
db.getSession().then(route).catch(() => show('login'));

// ---------- Вкладки ----------
document.querySelector('.tabs').addEventListener('click', (e) => {
  const t = e.target.closest('.tab'); if (!t) return;
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  ['members', 'former', 'videos', 'badges', 'news'].forEach((n) => ($('tab-' + n).hidden = n !== t.dataset.tab));
});

// ---------- Универсальная форма ----------
function openForm(title, fields, values = {}) {
  return new Promise((resolve) => {
    const dlg = $('dlg'), form = $('dlg-form');
    form.innerHTML = `<h3>${esc(title)}</h3>` + fields.map((f) => {
      const v = values[f.name] ?? f.default ?? '';
      let input;
      if (f.type === 'select') input = `<select name="${f.name}" ${f.required ? 'required' : ''}>${f.options.map((o) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(f.labels?.[o] ?? o)}</option>`).join('')}</select>`;
      else if (f.type === 'textarea') input = `<textarea name="${f.name}" rows="${f.rows || 3}">${esc(v)}</textarea>`;
      else input = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${f.required ? 'required' : ''} ${f.pattern ? `pattern="${f.pattern}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>`;
      return `<label class="field"><span>${esc(f.label)}${f.required ? ' *' : ''}</span>${input}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`;
    }).join('') + `<div class="dialog-actions"><button type="button" class="btn btn-ghost btn-sm" data-cancel>Отмена</button><button type="submit" class="btn btn-pink btn-sm">Сохранить</button></div>`;
    form.querySelector('[data-cancel]').onclick = () => { dlg.close(); };
    dlg.onclose = () => resolve(dlg.returnValue === 'ok' ? dlg._data : null);
    dlg.returnValue = '';
    form.onsubmit = (e) => {
      e.preventDefault();
      dlg._data = Object.fromEntries(new FormData(form).entries());
      dlg.close('ok');
    };
    fields.forEach((f) => f.onInput && form.elements[f.name].addEventListener('input', () => f.onInput(form)));
    dlg.showModal();
  });
}

async function guard(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); }
  catch (e) { toast('Ошибка: ' + e.message, true); }
}

// ---------- Состав ----------
const memberFields = [
  { name: 'game_nick', label: 'Ник в игре', required: true },
  { name: 'discord_nick', label: 'Ник в Discord' },
  { name: 'discord_id', label: 'Discord ID', pattern: '\\d{15,20}', placeholder: '123456789012345678', hint: 'Необязательно. Discord → Настройки → Расширенные → Режим разработчика, затем ПКМ по человеку → «Копировать ID». На сайте ID не показывается, по нему ник становится ссылкой.' },
  { name: 'clan_role', label: 'Роль', type: 'select', options: ROLES, default: 'чундрик', required: true },
  { name: 'real_name', label: 'Реальное имя' },
  { name: 'joined_at', label: 'Дата вступления', type: 'date', default: today() },
];
let members = [];
async function loadMembers() { members = await db.getMembers(); renderMembers(); if (typeof renderBadges === 'function') renderBadges(); }
function renderMembers() {
  const q = $('members-search').value.trim().toLowerCase();
  const rows = members.filter((m) => !q || [m.game_nick, m.discord_nick, m.real_name].some((v) => String(v || '').toLowerCase().includes(q)));
  $('members-body').innerHTML = rows.map((m) => `<tr>
    <td><b>${esc(m.game_nick)}</b></td><td>${esc(m.discord_nick || '—')}</td><td class="muted">${esc(m.discord_id || '—')}</td>
    <td>${esc(m.clan_role)}</td><td>${esc(m.real_name || '—')}</td><td>${fmtDate(m.joined_at)}</td>
    <td class="actions">
      <button class="btn btn-olive btn-sm" data-act="edit" data-id="${m.id}">Изменить</button>
      <button class="btn btn-ghost btn-sm" data-act="badges" data-id="${m.id}">Значки${m.badges?.length ? ' (' + m.badges.length + ')' : ''}</button>
      <button class="btn btn-ghost btn-sm" data-act="move" data-id="${m.id}">В ушедшие</button>
      <button class="btn btn-danger btn-sm" data-act="del" data-id="${m.id}">Удалить</button>
    </td></tr>`).join('') || '<tr><td colspan="7" class="muted">Пусто</td></tr>';
}
$('members-search').addEventListener('input', renderMembers);
$('add-member').addEventListener('click', async () => {
  const d = await openForm('Новый участник', memberFields); if (!d) return;
  await guard(async () => { await db.createMember(d); await loadMembers(); }, 'Участник добавлен');
});
$('members-body').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const m = members.find((x) => x.id == b.dataset.id);
  if (b.dataset.act === 'edit') {
    const d = await openForm('Изменить: ' + m.game_nick, memberFields, m); if (!d) return;
    await guard(async () => { await db.updateMember(m.id, d); await loadMembers(); }, 'Сохранено');
  } else if (b.dataset.act === 'badges') {
    await editMemberBadges(m);
  } else if (b.dataset.act === 'move') {
    const d = await openForm(`Перенести ${m.game_nick} в ушедшие`, [
      { name: 'leave_type', label: 'Как ушёл', type: 'select', options: LEAVE_TYPES, required: true },
      { name: 'left_at', label: 'Дата ухода', type: 'date', default: today(), required: true },
      { name: 'reason', label: 'Причина', type: 'textarea' },
    ]); if (!d) return;
    await guard(async () => { await db.moveToFormer(m.id, d.leave_type, d.reason, d.left_at); await Promise.all([loadMembers(), loadFormer()]); }, `${m.game_nick} перенесён в ушедшие`);
  } else if (b.dataset.act === 'del') {
    if (!confirm(`Удалить ${m.game_nick} без переноса в ушедшие?`)) return;
    await guard(async () => { await db.deleteMember(m.id); await loadMembers(); }, 'Удалено');
  }
});

// ---------- Ушедшие ----------
const formerFields = [
  { name: 'game_nick', label: 'Ник в игре', required: true },
  { name: 'discord_nick', label: 'Ник в Discord' },
  { name: 'discord_id', label: 'Discord ID', pattern: '\\d{15,20}' },
  { name: 'clan_role', label: 'Роль', type: 'select', options: ROLES, default: 'чундрик' },
  { name: 'real_name', label: 'Реальное имя' },
  { name: 'joined_at', label: 'Дата вступления', type: 'date' },
  { name: 'left_at', label: 'Дата ухода', type: 'date', default: today() },
  { name: 'leave_type', label: 'Как ушёл', type: 'select', options: LEAVE_TYPES, required: true },
  { name: 'reason', label: 'Причина', type: 'textarea' },
];
let former = [];
async function loadFormer() { former = await db.getFormerMembers(); renderFormer(); }
function renderFormer() {
  const q = $('former-search').value.trim().toLowerCase();
  const rows = former.filter((m) => !q || [m.game_nick, m.discord_nick, m.real_name].some((v) => String(v || '').toLowerCase().includes(q)));
  $('former-body').innerHTML = rows.map((m) => `<tr>
    <td><b>${esc(m.game_nick)}</b></td><td>${esc(m.discord_nick || '—')}</td><td>${esc(m.clan_role || '—')}</td><td>${esc(m.real_name || '—')}</td>
    <td>${fmtDate(m.joined_at)}</td><td>${fmtDate(m.left_at)}</td><td>${esc(m.leave_type || '—')}</td><td>${esc(m.reason || '—')}</td>
    <td class="actions">
      <button class="btn btn-olive btn-sm" data-act="edit" data-id="${m.id}">Изменить</button>
      <button class="btn btn-danger btn-sm" data-act="del" data-id="${m.id}">Удалить</button>
    </td></tr>`).join('') || '<tr><td colspan="9" class="muted">Пока никто не уходил 🎉</td></tr>';
}
$('former-search').addEventListener('input', renderFormer);
$('add-former').addEventListener('click', async () => {
  const d = await openForm('Запись об ушедшем', formerFields); if (!d) return;
  await guard(async () => { await db.createFormer(d); await loadFormer(); }, 'Добавлено');
});
$('former-body').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const m = former.find((x) => x.id == b.dataset.id);
  if (b.dataset.act === 'edit') {
    const d = await openForm('Изменить: ' + m.game_nick, formerFields, m); if (!d) return;
    await guard(async () => { await db.updateFormer(m.id, d); await loadFormer(); }, 'Сохранено');
  } else if (b.dataset.act === 'del') {
    if (!confirm(`Удалить запись о ${m.game_nick}?`)) return;
    await guard(async () => { await db.deleteFormer(m.id); await loadFormer(); }, 'Удалено');
  }
});

// ---------- Видео ----------
const videoFields = [
  { name: 'url', label: 'Ссылка на видео', type: 'url', required: true, placeholder: 'https://youtu.be/… или https://www.tiktok.com/@…/video/…',
    onInput: (form) => { form.elements.platform.value = detectPlatform(form.elements.url.value); } },
  { name: 'platform', label: 'Площадка', type: 'select', options: ['youtube', 'tiktok', 'vk', 'other'], labels: PLATFORM_LABEL, default: 'other', hint: 'Определяется автоматически по ссылке.' },
  { name: 'title', label: 'Название', required: true },
  { name: 'short_desc', label: 'Короткое описание', type: 'textarea', rows: 2, hint: 'Видно сразу под видео.' },
  { name: 'long_desc', label: 'Подробное описание', type: 'textarea', rows: 5, hint: 'Раскрывается по кнопке «Подробнее».' },
  { name: 'sort_order', label: 'Порядок (меньше — выше)', type: 'number', default: 0 },
];
let videos = [];
async function loadVideos() { videos = await db.getVideos(); renderVideos(); }
function renderVideos() {
  $('videos-body').innerHTML = videos.map((v) => `<tr>
    <td>${esc(v.sort_order)}</td><td><b>${esc(v.title)}</b></td><td>${esc(PLATFORM_LABEL[v.platform] || v.platform)}</td>
    <td><a href="${esc(v.url)}" target="_blank" rel="noopener">открыть ↗</a></td><td class="muted">${esc(v.short_desc || '—')}</td>
    <td class="actions">
      <button class="btn btn-olive btn-sm" data-act="edit" data-id="${v.id}">Изменить</button>
      <button class="btn btn-danger btn-sm" data-act="del" data-id="${v.id}">Удалить</button>
    </td></tr>`).join('') || '<tr><td colspan="6" class="muted">Видео пока нет</td></tr>';
}
function normVideo(d) {
  d.sort_order = parseInt(d.sort_order, 10) || 0;
  if (!d.platform || d.platform === 'other') d.platform = detectPlatform(d.url);
  return d;
}
$('add-video').addEventListener('click', async () => {
  const next = videos.length ? Math.max(...videos.map((v) => v.sort_order || 0)) + 10 : 10;
  const d = await openForm('Новое видео', videoFields, { sort_order: next }); if (!d) return;
  await guard(async () => { await db.createVideo(normVideo(d)); await loadVideos(); }, 'Видео добавлено');
});
$('videos-body').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const v = videos.find((x) => x.id == b.dataset.id);
  if (b.dataset.act === 'edit') {
    const d = await openForm('Изменить видео', videoFields, v); if (!d) return;
    await guard(async () => { await db.updateVideo(v.id, normVideo(d)); await loadVideos(); }, 'Сохранено');
  } else if (b.dataset.act === 'del') {
    if (!confirm(`Удалить видео «${v.title}»?`)) return;
    await guard(async () => { await db.deleteVideo(v.id); await loadVideos(); }, 'Удалено');
  }
});

// ---------- Новости ----------
const newsFields = [
  { name: 'title', label: 'Заголовок', required: true },
  { name: 'body', label: 'Текст', type: 'textarea', rows: 12, required: true, hint: 'Абзацы разделяйте пустой строкой. Можно: **жирный**, [ссылка](https://…), списки со строк «- », подзаголовок «## ». Картинка в тексте: отдельной строкой ![описание](assets/news/… или https://…). Остальное показывается как обычный текст.' },
  { name: 'image_url', label: 'Картинка (URL, необязательно)', placeholder: 'https://… или assets/…' },
  { name: 'source_name', label: 'Название источника', placeholder: 'PUBG: BATTLEGROUNDS' },
  { name: 'source_url', label: 'Ссылка на источник', type: 'url', placeholder: 'https://…' },
  { name: 'published_at', label: 'Дата публикации', type: 'date', default: today(), required: true },
  { name: 'pinned', label: 'Закрепить сверху', type: 'select', options: ['нет', 'да'], default: 'нет' },
];
let news = [];
async function loadNews() { news = await db.getNews(); renderNews(); }
const moscowDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date(iso));
function renderNews() {
  const q = $('news-search').value.trim().toLowerCase();
  const rows = news.filter((n) => !q || n.title.toLowerCase().includes(q));
  $('news-body').innerHTML = rows.map((n) => `<tr>
    <td>${esc(fmtLong(n.published_at))}</td><td><b>${esc(n.title)}</b></td>
    <td class="muted">${n.source_url ? `<a href="${esc(n.source_url)}" target="_blank" rel="noopener">${esc(n.source_name || 'ссылка')} ↗</a>` : '—'}</td>
    <td>${n.pinned ? '📌' : ''}</td>
    <td class="actions">
      <button class="btn btn-ghost btn-sm" data-act="pin" data-id="${n.id}">${n.pinned ? 'Открепить' : 'Закрепить'}</button>
      <button class="btn btn-olive btn-sm" data-act="edit" data-id="${n.id}">Изменить</button>
      <button class="btn btn-danger btn-sm" data-act="del" data-id="${n.id}">Удалить</button>
    </td></tr>`).join('') || '<tr><td colspan="5" class="muted">Новостей пока нет</td></tr>';
}
function normNews(d) {
  const out = { ...d, pinned: d.pinned === 'да' };
  const day = d.published_at || today();
  // дату храним с полуднем по Москве, чтобы день не «съезжал» из-за часовых поясов
  out.published_at = new Date(`${day}T12:00:00+03:00`).toISOString();
  return out;
}
$('news-search').addEventListener('input', renderNews);
$('add-news').addEventListener('click', async () => {
  const d = await openForm('Новая новость', newsFields); if (!d) return;
  await guard(async () => { await db.createNews(normNews(d)); await loadNews(); }, 'Новость добавлена');
});
$('news-body').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const n = news.find((x) => x.id == b.dataset.id);
  if (b.dataset.act === 'pin') {
    await guard(async () => { await db.updateNews(n.id, { pinned: !n.pinned }); await loadNews(); }, n.pinned ? 'Откреплено' : 'Закреплено');
  } else if (b.dataset.act === 'edit') {
    const d = await openForm('Изменить новость', newsFields, { ...n, published_at: moscowDay(n.published_at), pinned: n.pinned ? 'да' : 'нет' }); if (!d) return;
    await guard(async () => { await db.updateNews(n.id, normNews(d)); await loadNews(); }, 'Сохранено');
  } else if (b.dataset.act === 'del') {
    if (!confirm(`Удалить новость «${n.title}»?`)) return;
    await guard(async () => { await db.deleteNews(n.id); await loadNews(); }, 'Удалено');
  }
});

// ---------- Значки ----------
const badgeFields = [
  { name: 'title', label: 'Название', required: true },
  { name: 'description', label: 'Описание', type: 'textarea', rows: 2, hint: 'Видно в подсказке при наведении на значок.' },
  { name: 'emoji', label: 'Эмодзи', hint: 'Используется, если нет картинки.' },
  { name: 'icon_url', label: 'Картинка (URL или путь)', placeholder: 'assets/badges/crown.webp', hint: 'Квадратная, лучше с прозрачным фоном. Если заполнена, эмодзи не показывается.' },
];
let badges = [];
const badgeThumb = (b) => b.icon_url ? `<img class="badge-thumb" src="${esc(b.icon_url)}" alt="">` : esc(b.emoji || '🏅');
async function loadBadges() { badges = await db.getBadges(); renderBadges(); }
function renderBadges() {
  $('badges-body').innerHTML = badges.map((b) => {
    const n = members.filter((m) => (m.badges || []).some((x) => x.id === b.id)).length;
    return `<tr><td>${badgeThumb(b)}</td><td><b>${esc(b.title)}</b></td><td class="muted">${esc(b.description || '—')}</td><td>${n}</td>
    <td class="actions">
      <button class="btn btn-olive btn-sm" data-act="edit" data-id="${b.id}">Изменить</button>
      <button class="btn btn-danger btn-sm" data-act="del" data-id="${b.id}">Удалить</button>
    </td></tr>`;
  }).join('') || '<tr><td colspan="5" class="muted">Значков пока нет</td></tr>';
}
function normBadge(d) {
  if (!d.emoji && !d.icon_url) throw new Error('Укажите эмодзи или картинку');
  return d;
}
$('add-badge').addEventListener('click', async () => {
  const d = await openForm('Новый значок', badgeFields); if (!d) return;
  await guard(async () => { await db.createBadge(normBadge(d)); await loadBadges(); }, 'Значок создан');
});
$('badges-body').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const x = badges.find((y) => y.id == b.dataset.id);
  if (b.dataset.act === 'edit') {
    const d = await openForm('Изменить значок', badgeFields, x); if (!d) return;
    await guard(async () => { await db.updateBadge(x.id, normBadge(d)); await Promise.all([loadBadges(), loadMembers()]); }, 'Сохранено');
  } else if (b.dataset.act === 'del') {
    if (!confirm(`Удалить значок «${x.title}»? Он пропадёт у всех, кому выдан.`)) return;
    await guard(async () => { await db.deleteBadge(x.id); await Promise.all([loadBadges(), loadMembers()]); }, 'Удалено');
  }
});

// Выдача и снятие значков у участника: чекбоксы + необязательная заметка
async function editMemberBadges(m) {
  if (!badges.length) { toast('Сначала создайте значок на вкладке «Значки»', true); return; }
  const have = new Map((m.badges || []).map((x) => [x.id, x]));
  const dlg = $('dlg'), form = $('dlg-form');
  const res = await new Promise((resolve) => {
    form.innerHTML = `<h3>Значки: ${esc(m.game_nick)}</h3><div class="check-list">` + badges.map((b) => {
      const h = have.get(b.id);
      return `<div class="check-row"><label><input type="checkbox" name="b${b.id}" ${h ? 'checked' : ''}> ${badgeThumb(b)} <span>${esc(b.title)}</span></label>
        <input type="text" name="n${b.id}" placeholder="Заметка (необязательно)" value="${esc(h?.note || '')}"></div>`;
    }).join('') + `</div><div class="dialog-actions"><button type="button" class="btn btn-ghost btn-sm" data-cancel>Отмена</button><button type="submit" class="btn btn-pink btn-sm">Сохранить</button></div>`;
    form.querySelector('[data-cancel]').onclick = () => dlg.close();
    dlg.onclose = () => resolve(dlg.returnValue === 'ok' ? dlg._data : null);
    dlg.returnValue = '';
    form.onsubmit = (ev) => { ev.preventDefault(); dlg._data = Object.fromEntries(new FormData(form).entries()); dlg.close('ok'); };
    dlg.showModal();
  });
  if (!res) return;
  await guard(async () => {
    for (const b of badges) {
      const on = res['b' + b.id] === 'on', h = have.get(b.id), note = (res['n' + b.id] || '').trim();
      if (on && (!h || (h.note || '') !== note)) await db.awardBadge(m.id, b.id, note, h?.awarded_at || today());
      else if (!on && h) await db.revokeBadge(m.id, b.id);
    }
    await loadMembers();
  }, 'Значки обновлены');
}

async function loadAll() {
  await Promise.all([loadBadges(), loadNews(), loadMembers(), loadFormer(), loadVideos()].map((p) => p.catch((e) => toast('Ошибка загрузки: ' + e.message, true))));
}
