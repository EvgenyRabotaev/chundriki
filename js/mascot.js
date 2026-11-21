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
const IMG = '<img src="assets/mascot-sit3.webp?v=5" srcset="assets/mascot-sit3-sm.webp?v=5 210w, assets/mascot-sit3.webp?v=5 420w" sizes="(max-width: 560px) 90px, 140px" alt="" width="420" height="568">';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return (m > 10 && m < 15) ? c : k === 1 ? a : (k > 1 && k < 5) ? b : c; };
// Разметка в репликах: [текст](ссылка). Только ссылки на страницы сайта (name.html) или http(s); остальное — обычный текст, HTML не исполняется.
const SAFE_HREF = /^(?:[\w-]+\.html(?:#[\w-]*)?|https?:\/\/[^\s"'<>]+)$/;
function parseMarkup(text) {
  const parts = []; const re = /\[([^\]]+)\]\(([^)\s]+)\)/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index) });
    parts.push(SAFE_HREF.test(m[2]) ? { t: m[1], href: m[2] } : { t: m[1] });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ t: text.slice(last) });
  return parts;
}
const plainText = (text) => parseMarkup(text).map((p) => p.t).join('');
function renderTyped(el, parts, n) { // показать первые n символов, ссылки остаются ссылками
  el.textContent = '';
  for (const p of parts) {
    if (n <= 0) break; const chunk = p.t.slice(0, n); n -= chunk.length;
    if (p.href) { const a = document.createElement('a'); a.href = p.href; a.textContent = chunk; if (/^https?:/.test(p.href)) { a.target = '_blank'; a.rel = 'noopener'; } el.appendChild(a); }
    else el.appendChild(document.createTextNode(chunk));
  }
}
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
    for (const r of rows) {
      if (r.kind === 'badge' && !r.badges?.slug) continue; // шутка про медальку без медальки — не показываем никому
      addLine(r.kind, r.text, r.kind === 'badge' ? r.badges.slug : r.page);
    }
  } catch { useFallback(); }
  try { if ((await getSession())) profile = await getMascotProfile(); } catch {}
}

const fill = (t) => {
  const d = profile?.joined_at ? Math.max(0, Math.floor((Date.now() - new Date(profile.joined_at)) / 864e5)) : null;
  return t.replace(/\{nick\}/g, profile?.nick || 'боец').replace(/\{days\}/g, d == null ? 'давно' : `${d} ${plural(d, 'день', 'дня', 'дней')}`);
};
// Последовательность реплик хранится в sessionStorage, чтобы не сбрасываться при переходе между страницами.
// g — приветствие уже было; k — сколько реплик после приветствия; bp — позиция «медальной» реплики в текущем блоке из 5;
// bo — смещение для ротации медальных реплик; last — последняя реплика (чтобы не повторять подряд).
const SS = 'chundriki.mchat.seq';
const seq = (() => { try { return JSON.parse(sessionStorage.getItem(SS)) || {}; } catch { return {}; } })();
const saveSeq = () => { try { sessionStorage.setItem(SS, JSON.stringify(seq)); } catch {} };
const used = new Set();
const days = () => profile?.joined_at ? Math.max(0, Math.floor((Date.now() - new Date(profile.joined_at)) / 864e5)) : null;
function greeting() { // всегда с игровым ником; без даты вступления — без части про дни
  let t = pool.member[0] || 'Привет, {nick}! Ты в клане уже {days}. Время летит, лаги остаются.';
  if (days() == null) t = t.replace(/\s*Ты в клане уже \{days\}\.?/, '');
  return fill(t);
}
function badgeLines() { const out = []; for (const sl of profile?.badges || []) for (const t of pool.badge[sl] || []) out.push(t); return out; }
function nextLine() {
  if (profile && !seq.g) { seq.g = 1; saveSeq(); return greeting(); }
  const k = seq.k || 0, pos = k % 5;
  if (pos === 0) seq.bp = Math.floor(Math.random() * 5);
  const bl = badgeLines();
  let t;
  if (bl.length && pos === seq.bp) { // в каждом блоке из 5 реплик ровно одна про медальки участника, по кругу
    if (seq.bo == null) seq.bo = Math.floor(Math.random() * bl.length);
    t = bl[seq.bo % bl.length]; seq.bo++;
    if (t === seq.last && bl.length > 1) { t = bl[seq.bo % bl.length]; seq.bo++; }
  } else {
    const cand = [];
    for (const x of pool.page[page] || []) cand.push(x, x);
    for (const x of pool.general) cand.push(x);
    let fresh = cand.filter((x) => !used.has(x) && x !== seq.last);
    if (!fresh.length) { used.clear(); fresh = cand.filter((x) => x !== seq.last); }
    t = pick(fresh.length ? fresh : cand); used.add(t);
  }
  seq.k = k + 1; seq.last = t; saveSeq();
  return fill(t);
}

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
  let timer = null, run = 0, count = 0, hovered = false;
  root.addEventListener('mouseenter', () => { hovered = true; }); root.addEventListener('mouseleave', () => { hovered = false; });
  bubble.addEventListener('click', (e) => { if (e.target.closest('a')) return; run++; bubble.classList.remove('on'); });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function applyHidden() { root.hidden = !!st.hidden; peek.hidden = !st.hidden; }
  async function speak(text) {
    const my = ++run;
    bubble.classList.remove('on'); await wait(bubble.classList.contains('on') ? 0 : 50);
    const parts = parseMarkup(text), plain = plainText(text);
    ghost.textContent = plain; typed.textContent = ''; bubble.classList.add('on');
    if (REDUCED) renderTyped(typed, parts, plain.length);
    else for (let i = 1; i <= plain.length; i++) { if (my !== run) return; renderTyped(typed, parts, i); await wait(28 + Math.random() * 22); }
    let left = Math.min(25000, 12000 + plain.length * 70);
    while (left > 0 && my === run) { await wait(200); if (!hovered) left -= 200; }
    if (my === run) bubble.classList.remove('on');
  }
  function schedule(ms) { clearTimeout(timer); if (!st.hidden) timer = setTimeout(auto, ms); }
  async function auto() {
    if (st.hidden || document.hidden || count >= MAX_LINES) return count >= MAX_LINES ? undefined : schedule(GAP_MS);
    count++; const t = nextLine();
    schedule(GAP_MS); await speak(t); // отсчёт 60 с — от начала реплики
  }
  root.querySelector('.mchat-fig').addEventListener('click', async () => { clearTimeout(timer); count++; await speak(nextLine()); schedule(GAP_MS); });
  root.querySelector('.mchat-x').addEventListener('click', () => { st.hidden = true; save(); run++; bubble.classList.remove('on'); clearTimeout(timer); applyHidden(); });
  peek.addEventListener('click', async () => { st.hidden = false; save(); applyHidden(); clearTimeout(timer); await speak('Я вернулся! ' + nextLine()); schedule(GAP_MS); });
  let pressT; // долгое нажатие на мобильном тоже прячет
  root.querySelector('.mchat-fig').addEventListener('touchstart', () => { pressT = setTimeout(() => root.querySelector('.mchat-x').click(), 900); }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach((e) => root.querySelector('.mchat-fig').addEventListener(e, () => clearTimeout(pressT), { passive: true }));
  applyHidden(); schedule(FIRST_MS);
}

await load();
build();
