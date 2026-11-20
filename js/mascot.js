// Маскот-болтун: сидит в правом нижнем углу, реплики печатает в пузыре слева над собой. Шутки берёт из таблицы mascot_lines, а если её нет — из запасного пула.
import { getMascotLines, getMascotProfile, getSession } from './data.js?v=33';
import { FALLBACK } from './mascot-lines.js';

const LS = 'chundriki.mchat';
const page = document.body.dataset.page || 'index';
if (page === 'admin') throw new Error('mascot: skip admin');
const st = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } })();
const save = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch {} };
const params = new URLSearchParams(location.search);
const FAST = params.has('mascot'); // ?mascot=1 — для отладки: пузырёк через 1.5 с
const MOBILE = matchMedia('(max-width: 560px)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FIRST_MS = FAST ? 1200 : 12000, GAP_MS = FAST ? 6000 : 60000, MAX_LINES = MOBILE ? 5 : 10;
const IMG = '<img src="assets/mascot-sit.webp?v=3" srcset="assets/mascot-sit-sm.webp?v=3 210w, assets/mascot-sit.webp?v=3 420w" sizes="(max-width: 560px) 90px, 140px" alt="" width="420" height="601">';

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
const greet = () => profile ? fill('Привет, {nick}! Ты в клане уже {days}.') : 'Привет! Я Чундрик. Кликни по мне — расскажу прикол.';

function build() {
  const root = document.createElement('div');
  root.className = 'mchat';
  root.innerHTML = `<div class="mchat-bubble" role="status" aria-live="polite"><span class="ghost"></span><span class="typed"></span></div>
    <button class="mchat-fig" type="button" aria-label="Чундрик: послушать прикол">${IMG}</button>
    <button class="mchat-x" type="button" aria-label="Спрятать Чундрика" title="Спрятать">×</button>`;
  const peek = document.createElement('button');
  peek.className = 'mchat-peek'; peek.type = 'button'; peek.setAttribute('aria-label', 'Вернуть Чундрика'); peek.title = 'Вернуть Чундрика';
  peek.innerHTML = IMG;
  document.body.append(root, peek);
  const bubble = root.querySelector('.mchat-bubble'), ghost = bubble.querySelector('.ghost'), typed = bubble.querySelector('.typed');
  let timer = null, run = 0, count = 0, greeted = false, hovered = false;
  root.addEventListener('mouseenter', () => { hovered = true; }); root.addEventListener('mouseleave', () => { hovered = false; });
  bubble.addEventListener('click', () => { run++; bubble.classList.remove('on'); });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function applyHidden() { root.hidden = !!st.hidden; peek.hidden = !st.hidden; }
  async function speak(text) {
    const my = ++run;
    bubble.classList.remove('on'); await wait(bubble.classList.contains('on') ? 0 : 50);
    ghost.textContent = text; typed.textContent = ''; bubble.classList.add('on');
    if (REDUCED) typed.textContent = text;
    else for (let i = 1; i <= text.length; i++) { if (my !== run) return; typed.textContent = text.slice(0, i); await wait(28 + Math.random() * 22); }
    let left = Math.min(25000, 12000 + text.length * 70);
    while (left > 0 && my === run) { await wait(200); if (!hovered) left -= 200; }
    if (my === run) bubble.classList.remove('on');
  }
  function schedule(ms) { clearTimeout(timer); if (!st.hidden) timer = setTimeout(auto, ms); }
  async function auto() {
    if (st.hidden || document.hidden || count >= MAX_LINES) return count >= MAX_LINES ? undefined : schedule(GAP_MS);
    count++; const t = greeted ? nextLine() : (greeted = true, greet());
    schedule(GAP_MS); await speak(t); // отсчёт 60 с — от начала реплики
  }
  root.querySelector('.mchat-fig').addEventListener('click', async () => { clearTimeout(timer); count++; greeted = true; await speak(nextLine()); schedule(GAP_MS); });
  root.querySelector('.mchat-x').addEventListener('click', () => { st.hidden = true; save(); run++; bubble.classList.remove('on'); clearTimeout(timer); applyHidden(); });
  peek.addEventListener('click', async () => { st.hidden = false; save(); applyHidden(); clearTimeout(timer); await speak('Я вернулся! ' + nextLine()); schedule(GAP_MS); });
  let pressT; // долгое нажатие на мобильном тоже прячет
  root.querySelector('.mchat-fig').addEventListener('touchstart', () => { pressT = setTimeout(() => root.querySelector('.mchat-x').click(), 900); }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach((e) => root.querySelector('.mchat-fig').addEventListener(e, () => clearTimeout(pressT), { passive: true }));
  applyHidden(); schedule(FIRST_MS);
}

await load();
build();
