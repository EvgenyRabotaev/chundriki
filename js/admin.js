import * as db from './data.js?v=33';
import { detectPlatform, PLATFORM_LABEL } from './video.js';
import { esc, fmtDate, fmtLong, toast, safeUrl } from './util.js?v=33';
import { newsDetailHtml } from './news-view.js?v=33';
import { toEditorHtml } from './rich.js?v=33';
import { createEditor } from './editor.js?v=33';

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
  if (/access_token|error_description/.test(location.hash)) setTimeout(() => openTab(localStorage.getItem('admin-tab') || 'members'), 500);
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
const TABS = ['members', 'former', 'videos', 'badges', 'news', 'events'];
function openTab(name) {
  if (!TABS.includes(name)) name = 'members';
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  TABS.forEach((n) => ($('tab-' + n).hidden = n !== name));
  try { localStorage.setItem('admin-tab', name); } catch {}
  // не трогаем адрес, пока в нём ответ входа через Discord (#access_token=…)
  if (location.hash !== '#' + name && (!location.hash || TABS.includes(location.hash.slice(1)))) history.replaceState(null, '', '#' + name);
}
document.querySelector('.tabs').addEventListener('click', (e) => {
  const t = e.target.closest('.tab'); if (t) openTab(t.dataset.tab);
});
// после перезагрузки открываем ту же вкладку: из адреса (#news) или из памяти браузера
const hashTab = () => { const h = location.hash.slice(1); return TABS.includes(h) ? h : ''; };
openTab(hashTab() || (() => { try { return localStorage.getItem('admin-tab'); } catch { return ''; } })() || 'members');
window.addEventListener('hashchange', () => { if (hashTab()) openTab(hashTab()); });

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
  { name: 'birthday', label: 'День рождения (ДД.ММ)', pattern: '(0?[1-9]|[12]\\d|3[01])\\.(0?[1-9]|1[0-2])', placeholder: '16.11', hint: 'Необязательно, год не нужен. Видно только админам; на сайте в день рождения появляется лишь ник в блоке «Сегодня в клане».' },
];
let members = [];
let birthdays = new Map();
async function saveBirthday(id, v) {
  if (!v) return db.setBirthday(id, null, null);
  const [d, m] = v.split('.').map(Number);
  if (!d || !m || m > 12 || d > [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]) throw new Error('Неверный день рождения, нужен формат ДД.ММ');
  return db.setBirthday(id, d, m);
}
async function loadMembers() { members = await db.getMembers(); try { birthdays = new Map((await db.getBirthdays()).map((b) => [b.member_id, String(b.birth_day).padStart(2, '0') + '.' + String(b.birth_month).padStart(2, '0')])); } catch {} renderMembers(); if (typeof renderBadges === 'function') renderBadges(); }
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
  const { birthday, ...md } = d;
  await guard(async () => { const m = await db.createMember(md); if (birthday) await saveBirthday(m.id, birthday); await loadMembers(); }, 'Участник добавлен');
});
$('members-body').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const m = members.find((x) => x.id == b.dataset.id);
  if (b.dataset.act === 'edit') {
    const d = await openForm('Изменить: ' + m.game_nick, memberFields, { ...m, birthday: birthdays.get(m.id) || '' }); if (!d) return;
    const { birthday, ...md } = d;
    await guard(async () => { await db.updateMember(m.id, md); if ((birthday || '') !== (birthdays.get(m.id) || '')) await saveBirthday(m.id, birthday); await loadMembers(); }, 'Сохранено');
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
let news = [];
async function loadNews() { news = await db.getNews(undefined, true); renderNews(); }
const moscowDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date(iso));
const previewUrl = (n) => n.status === 'draft' ? `news.html?id=${n.id}&preview=${encodeURIComponent(n.preview_token || '')}` : `news.html?id=${n.id}`;
const EYE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
function renderNews() {
  const q = $('news-search').value.trim().toLowerCase();
  const rows = news.filter((n) => !q || n.title.toLowerCase().includes(q));
  $('news-body').innerHTML = rows.map((n) => `<tr>
    <td>${esc(fmtLong(n.published_at))}</td><td>${n.status === 'draft' ? '<span class="badge-draft">черновик</span> ' : ''}<b>${esc(n.title)}</b></td>
    <td class="muted">${n.source_url ? `<a href="${esc(n.source_url)}" target="_blank" rel="noopener">${esc(n.source_name || 'ссылка')} ↗</a>` : '—'}</td>
    <td>${n.pinned ? '📌' : ''}</td>
    <td class="actions">
      <button class="btn btn-ghost btn-sm btn-icon" data-act="preview" data-id="${n.id}" title="Предпросмотр">${EYE}<span>Предпросмотр</span></button>
      ${n.status === 'draft' ? `<button class="btn btn-olive btn-sm" data-act="publish" data-id="${n.id}">Опубликовать</button>` : ''}
      <button class="btn btn-ghost btn-sm" data-act="pin" data-id="${n.id}">${n.pinned ? 'Открепить' : 'Закрепить'}</button>
      <button class="btn btn-olive btn-sm" data-act="edit" data-id="${n.id}">Изменить</button>
      <button class="btn btn-danger btn-sm" data-act="del" data-id="${n.id}">Удалить</button>
    </td></tr>`).join('') || '<tr><td colspan="5" class="muted">Новостей пока нет</td></tr>';
}

// Сжатие картинки в браузере: webp, не шире 1600px (gif грузим как есть, чтобы не терять анимацию)
async function prepareImage(file) {
  if (file.type === 'image/gif') { if (file.size > 6e6) throw new Error('GIF больше 6 МБ'); return { blob: file, ext: 'gif' }; }
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, 1600 / bmp.width);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  let blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.85));
  if (blob && blob.type === 'image/webp') return { blob, ext: 'webp' };
  blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  return { blob, ext: 'jpg' };
}
async function uploadImage(file) {
  const { blob, ext } = await prepareImage(file);
  return db.uploadNewsImage(blob, ext);
}

// Предпросмотр: ровно та же разметка и стили, что на сайте
function showPreview(n) {
  const dlg = $('preview-dlg');
  $('preview-body').innerHTML = `<article class="news-detail">${newsDetailHtml(n, { back: false, comments: false })}</article>`;
  const open = $('preview-open');
  open.hidden = !n.id; if (n.id) open.href = previewUrl(n);
  dlg.showModal();
  $('preview-body').scrollTop = 0;
}
$('preview-close').addEventListener('click', () => $('preview-dlg').close());
$('preview-dlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

// Окно редактирования новости
const IMG_ICO = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/></svg>';
function editNews(n) {
  const isNew = !n;
  n = n || { title: '', body: '', image_url: '', source_name: '', source_url: '', published_at: new Date().toISOString(), pinned: false, status: 'draft' };
  const dlg = $('news-dlg');
  dlg.innerHTML = `<form class="ned" novalidate>
    <header class="ned-head">
      <h3>${isNew ? 'Новая новость' : 'Изменить новость'}</h3>
      <div class="seg ned-mode" role="tablist"><button type="button" class="on" data-mode="edit">Редактор</button><button type="button" data-mode="preview">Предпросмотр</button></div>
      <button type="button" class="icon-x" data-close aria-label="Закрыть" title="Закрыть">×</button>
    </header>
    <div class="ned-main">
      <div class="ned-col">
        <input class="ned-title" name="title" placeholder="Заголовок новости" required value="${esc(n.title)}">
        <div class="ned-editor"></div>
        <div class="ned-preview" hidden><article class="news-detail"></article></div>
      </div>
      <aside class="ned-side">
        <div class="field"><span>Статус</span>
          <div class="seg ned-status"><button type="button" data-status="draft">Черновик</button><button type="button" data-status="published">Опубликовано</button></div>
          <small class="ned-status-hint"></small></div>
        <label class="field"><span>Дата публикации</span><input type="date" name="published_at" required value="${esc(moscowDay(n.published_at))}"></label>
        <label class="switch"><input type="checkbox" name="pinned" ${n.pinned ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span><span>Закрепить сверху</span></label>
        <div class="field"><span>Обложка</span>
          <div class="cover-box"><img alt="" hidden><span class="cover-empty">Нет картинки</span></div>
          <div class="cover-actions"><button type="button" class="btn btn-ghost btn-sm" data-cover="upload">${IMG_ICO}Загрузить с компьютера</button><button type="button" class="btn btn-ghost btn-sm" data-cover="clear" title="Убрать обложку">Убрать</button></div>
          <input name="image_url" placeholder="или ссылка: https://… / assets/…" value="${esc(n.image_url || '')}">
          <input type="file" accept="image/*" class="cover-file" hidden>
        </div>
        <label class="field"><span>Название источника</span><input name="source_name" placeholder="PUBG: BATTLEGROUNDS" value="${esc(n.source_name || '')}"></label>
        <label class="field"><span>Ссылка на источник</span><input name="source_url" type="url" placeholder="https://…" value="${esc(n.source_url || '')}"></label>
      </aside>
    </div>
    <footer class="ned-foot">
      <span class="muted ned-note">Картинку в текст можно вставить кнопкой, перетащить или вставить из буфера. Клик по картинке — размер и выравнивание.</span>
      <button type="button" class="btn btn-ghost btn-sm" data-close>Отмена</button>
      <button type="submit" class="btn btn-pink btn-sm">Сохранить</button>
    </footer>
  </form>`;
  const form = dlg.querySelector('form');
  let dirty = false, status = n.status || 'published';
  const ed = createEditor(form.querySelector('.ned-editor'), { html: toEditorHtml(n.body), upload: uploadImage, onChange: () => { dirty = true; }, toast });
  form.addEventListener('input', () => { dirty = true; });

  const setStatus = (s) => {
    status = s;
    form.querySelectorAll('[data-status]').forEach((b) => b.classList.toggle('on', b.dataset.status === s));
    form.querySelector('.ned-status-hint').textContent = s === 'draft' ? 'Не видна на сайте и не уходит в Telegram/Discord.'
      : (n.status === 'published' ? 'Видна на сайте.' : 'После сохранения появится на сайте и уйдёт в Telegram и Discord.');
  };
  setStatus(status);
  form.querySelector('.ned-status').addEventListener('click', (e) => { const b = e.target.closest('[data-status]'); if (b) { setStatus(b.dataset.status); dirty = true; } });

  const coverImg = form.querySelector('.cover-box img'), coverEmpty = form.querySelector('.cover-empty'), coverIn = form.elements.image_url;
  const drawCover = () => { const u = safeUrl(coverIn.value); coverImg.hidden = !u; coverEmpty.hidden = !!u; if (u) coverImg.src = u; };
  drawCover(); coverIn.addEventListener('input', drawCover);
  const coverFile = form.querySelector('.cover-file');
  form.querySelector('[data-cover="upload"]').onclick = () => coverFile.click();
  form.querySelector('[data-cover="clear"]').onclick = () => { coverIn.value = ''; drawCover(); dirty = true; };
  coverFile.onchange = async () => {
    const f = coverFile.files[0]; coverFile.value = ''; if (!f) return;
    const box = form.querySelector('.cover-box'); box.classList.add('busy');
    try { coverIn.value = await uploadImage(f); drawCover(); dirty = true; toast('Картинка загружена'); }
    catch (e) { toast('Не удалось загрузить: ' + e.message, true); }
    finally { box.classList.remove('busy'); }
  };

  const collect = () => ({
    title: form.elements.title.value.trim(), body: ed.getHTML(), image_url: coverIn.value.trim(),
    source_name: form.elements.source_name.value.trim(), source_url: form.elements.source_url.value.trim(),
    published_at: new Date(`${form.elements.published_at.value || today()}T12:00:00+03:00`).toISOString(), // полдень по Москве — день не «съезжает»
    pinned: form.elements.pinned.checked, status,
  });
  form.querySelector('.ned-mode').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    form.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
    const pv = b.dataset.mode === 'preview';
    form.querySelector('.ned-editor').hidden = pv; form.elements.title.hidden = pv;
    form.querySelector('.ned-preview').hidden = !pv;
    if (pv) form.querySelector('.ned-preview article').innerHTML = newsDetailHtml({ ...n, ...collect(), title: form.elements.title.value || 'Без заголовка' }, { back: false, comments: false });
  });

  const close = () => { if (dirty && !confirm('Закрыть без сохранения? Изменения пропадут.')) return; dlg.close(); };
  form.querySelectorAll('[data-close]').forEach((b) => (b.onclick = close));
  dlg.oncancel = (e) => { e.preventDefault(); close(); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const d = collect();
    if (!d.title) { toast('Нужен заголовок', true); form.elements.title.focus(); return; }
    if (ed.isEmpty()) { toast('Нужен текст новости', true); return; }
    if (d.source_url && !/^https?:\/\//i.test(d.source_url)) { toast('Ссылка на источник должна начинаться с https://', true); return; }
    if (d.status === 'published' && n.status !== 'published' && !confirm(`Опубликовать «${d.title}»? Она появится на сайте и уйдёт в Telegram и Discord.`)) return;
    const btn = e.submitter; if (btn) btn.disabled = true;
    try {
      if (!isNew && n.status === 'draft' && d.status === 'published') {
        // сначала сохраняем текст черновиком, потом переводим статус — так сработает публикация в Telegram
        await db.updateNews(n.id, { ...d, status: 'draft' });
        await db.updateNews(n.id, { status: 'published' });
      } else if (isNew) await db.createNews(d);
      else await db.updateNews(n.id, d);
      dirty = false; dlg.close();
      toast(d.status === 'published' && n.status !== 'published' ? 'Опубликовано' : isNew ? 'Черновик сохранён' : 'Сохранено');
      await loadNews();
    } catch (err) { toast('Ошибка: ' + err.message, true); }
    finally { if (btn) btn.disabled = false; }
  };
  dlg.showModal();
  form.elements.title.focus();
}

$('news-search').addEventListener('input', renderNews);
$('add-news').addEventListener('click', () => editNews(null));
$('news-body').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const n = news.find((x) => x.id == b.dataset.id);
  if (b.dataset.act === 'preview') showPreview(n);
  else if (b.dataset.act === 'publish') {
    if (!confirm(`Опубликовать «${n.title}»? Она появится на сайте и уйдёт в Telegram и Discord.`)) return;
    await guard(async () => { await db.updateNews(n.id, { status: 'published' }); await loadNews(); }, 'Опубликовано');
  } else if (b.dataset.act === 'pin') {
    await guard(async () => { await db.updateNews(n.id, { pinned: !n.pinned }); await loadNews(); }, n.pinned ? 'Откреплено' : 'Закреплено');
  } else if (b.dataset.act === 'edit') editNews(n);
  else if (b.dataset.act === 'del') {
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

// ---------- События ----------
const eventFields = [
  { name: 'title', label: 'Заголовок', required: true },
  { name: 'description', label: 'Описание', type: 'textarea', rows: 2 },
  { name: 'event_date', label: 'Дата', type: 'date', required: true, default: today() },
  { name: 'recurring_yearly', label: 'Повторять каждый год', type: 'select', options: ['no', 'yes'], labels: { no: 'Нет, один раз', yes: 'Да, каждый год' } },
  { name: 'emoji', label: 'Эмодзи', placeholder: '🎉' },
];
let events = [];
async function loadEvents() { events = await db.getClanEvents(); renderEvents(); }
function renderEvents() {
  $('events-body').innerHTML = events.map((e) => `<tr><td>${esc(e.emoji || '📅')}</td><td>${fmtDate(e.event_date)}</td><td>${e.recurring_yearly ? 'каждый год' : 'один раз'}</td>
    <td><b>${esc(e.title)}</b><div class="muted">${esc(e.description || '')}</div></td>
    <td class="actions"><button class="btn btn-olive btn-sm" data-act="edit" data-id="${e.id}">Изменить</button>
    <button class="btn btn-danger btn-sm" data-act="del" data-id="${e.id}">Удалить</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Событий пока нет</td></tr>';
}
const evOut = (d) => ({ ...d, recurring_yearly: d.recurring_yearly === 'yes' });
$('add-event').addEventListener('click', async () => {
  const d = await openForm('Новое событие', eventFields); if (!d) return;
  await guard(async () => { await db.createClanEvent(evOut(d)); await loadEvents(); }, 'Событие добавлено');
});
$('events-body').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const x = events.find((y) => y.id == b.dataset.id);
  if (b.dataset.act === 'edit') {
    const d = await openForm('Изменить событие', eventFields, { ...x, recurring_yearly: x.recurring_yearly ? 'yes' : 'no' }); if (!d) return;
    await guard(async () => { await db.updateClanEvent(x.id, evOut(d)); await loadEvents(); }, 'Сохранено');
  } else if (b.dataset.act === 'del') {
    if (!confirm(`Удалить событие «${x.title}»?`)) return;
    await guard(async () => { await db.deleteClanEvent(x.id); await loadEvents(); }, 'Удалено');
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
  await Promise.all([loadEvents(), loadBadges(), loadNews(), loadMembers(), loadFormer(), loadVideos()].map((p) => p.catch((e) => toast('Ошибка загрузки: ' + e.message, true))));
}
