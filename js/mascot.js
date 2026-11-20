// Маскот-болтун: пузырёк в правом нижнем углу. Шутки берёт из таблицы mascot_lines, а если её нет — из запасного пула.
import { getMascotLines, getMascotProfile, getSession } from './data.js?v=33';
import { FALLBACK } from './mascot-lines.js';

const LS = 'chundriki.mchat';
const page = document.body.dataset.page || 'index';
if (page === 'admin') throw new Error('mascot: skip admin');
const st = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } })();
const save = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch {} };
const params = new URLSearchParams(location.search);
const FAST = params.has('mascot'); // ?mascot=1 — для отладки: пузырёк через 1.5 с
const FIRST_MS = FAST ? 1500 : 20000, GAP_MS = 45000, MAX_BUBBLES = 3;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return (m > 10 && m < 15) ? c : k === 1 ? a : (k > 1 && k < 5) ? b : c; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

let pool = { general: [], badge: {}, member: [], page: {} }, profile = null;
function addLine(kind, text, key) {
  if (kind === 'general') pool.general.push(text);
  else if (kind === 'member') pool.member.push(text);
  else (pool[kind][key] ||= []).push(text);
}
function useFallback() {
  pool = { general: [...FALLBACK.general], member: [...FALLBACK.member.hello], badge: {}, page: {} };
  for (const [k, v] of Object.entries(FALLBACK.badge)) pool.badge[k] = [...v];
  for (const [k, v] of Object.entries(FALLBACK.page)) pool.page[k] = [...v];
}
async function load() {
  try {
    const rows = await getMascotLines();
    if (!rows.length) throw new Error('empty');
    pool = { general: [], badge: {}, member: [], page: {} };
    for (const r of rows) addLine(r.kind, r.text, r.kind === 'badge' ? r.badges?.slug : r.page);
  } catch { useFallback(); }
  try { if ((await getSession())) profile = await getMascotProfile(); } catch {}
}

const fill = (t) => {
  const days = profile?.joined_at ? Math.max(0, Math.floor((Date.now() - new Date(profile.joined_at)) / 864e5)) : null;
  return t.replace(/\{nick\}/g, profile?.nick || 'боец').replace(/\{days\}/g, days == null ? 'давно' : `${days} ${plural(days, 'день', 'дня', 'дней')}`);
};
const used = new Set();
function nextLine() {
  const cand = [];
  if (profile) {
    for (const s of profile.badges || []) for (const t of pool.badge[s] || []) cand.push(t, t);
    for (const t of pool.member) cand.push(t);
  }
  for (const t of pool.page[page] || []) cand.push(t, t);
  for (const t of pool.general) cand.push(t);
  let fresh = cand.filter((t) => !used.has(t));
  if (!fresh.length) { used.clear(); fresh = cand; }
  const t = pick(fresh); used.add(t); return fill(t);
}
const greet = () => profile ? fill(`Привет, {nick}! Я Чундрик. Ты в клане уже {days}. Хочешь прикол?`) : 'Привет! Я Чундрик, местный маскот. Хочешь прикол?';

function build() {
  const root = document.createElement('div');
  root.className = 'mchat'; root.id = 'mchat';
  root.innerHTML = `
    <div class="mchat-bubble" role="status" hidden><button class="mchat-bubble-x" aria-label="Скрыть">×</button><span class="mchat-bubble-t"></span></div>
    <section class="mchat-panel" hidden aria-label="Чат с Чундриком">
      <header><img src="assets/mascot-sm.webp" alt="" width="34" height="34"><b>Чундрик</b><span class="mchat-on">на связи</span>
        <button class="mchat-mute" type="button"></button><button class="mchat-close" type="button" aria-label="Закрыть">×</button></header>
      <div class="mchat-log" aria-live="polite"></div>
      <footer><button class="mchat-more" type="button">Ещё прикол</button></footer>
    </section>
    <button class="mchat-fab" type="button" aria-label="Открыть чат с Чундриком"><img src="assets/mascot-sm.webp" alt="" width="64" height="64"></button>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const bubble = $('.mchat-bubble'), panel = $('.mchat-panel'), log = $('.mchat-log'), fab = $('.mchat-fab'), mute = $('.mchat-mute');
  let shown = 0, timer = null, opened = false;
  const renderMute = () => { mute.textContent = st.muted ? '🔔 Включить' : '🔕 Тише'; mute.title = st.muted ? 'Снова показывать подсказки' : 'Больше не всплывать'; };
  renderMute();
  const say = (t, cls = '') => {
    const m = document.createElement('div'); m.className = 'mchat-msg ' + cls; m.textContent = t; log.appendChild(m);
    log.scrollTop = log.scrollHeight; return m;
  };
  const typing = (t) => new Promise((res) => {
    const d = say('', 'typing'); d.innerHTML = '<i></i><i></i><i></i>';
    setTimeout(() => { d.className = 'mchat-msg'; d.textContent = t; log.scrollTop = log.scrollHeight; res(); }, FAST ? 200 : 700);
  });
  const hideBubble = () => { bubble.hidden = true; };
  const open = async () => {
    hideBubble(); clearTimeout(timer); panel.hidden = false; fab.setAttribute('aria-expanded', 'true');
    if (!opened) { opened = true; await typing(greet()); await typing(nextLine()); }
  };
  const close = () => { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); };
  fab.addEventListener('click', () => (panel.hidden ? open() : close()));
  $('.mchat-close').addEventListener('click', close);
  $('.mchat-more').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; say('Ещё прикол!', 'me'); await typing(nextLine()); b.disabled = false;
  });
  mute.addEventListener('click', () => { st.muted = !st.muted; save(); renderMute(); if (st.muted) { hideBubble(); clearTimeout(timer); } else schedule(GAP_MS); });
  $('.mchat-bubble-x').addEventListener('click', (e) => { e.stopPropagation(); hideBubble(); });
  bubble.addEventListener('click', open);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  function pop() {
    if (st.muted || !panel.hidden || shown >= MAX_BUBBLES || document.hidden) return schedule(GAP_MS);
    shown++; $('.mchat-bubble-t').textContent = nextLine(); bubble.hidden = false;
    setTimeout(hideBubble, 9000); if (shown < MAX_BUBBLES) schedule(GAP_MS + 9000);
  }
  function schedule(ms) { clearTimeout(timer); if (!st.muted) timer = setTimeout(pop, ms); }
  schedule(FIRST_MS);
}

await load();
build();
