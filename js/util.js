export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return `${day}.${m}.${y}`;
}
export function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return alert(msg);
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
}
export const ROLE_CLASS = { 'глава': 'role-leader', 'руководитель': 'role-admin', 'чундрик': 'role-soldier' };
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export function fmtMonth(d) {
  if (!d) return '';
  const [y, m] = String(d).slice(0, 10).split('-');
  return MONTHS[+m - 1] ? `${MONTHS[+m - 1]} ${y}` : '';
}
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export function fmtLong(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt).split('-');
  return `${+p[2]} ${MONTHS_GEN[+p[1] - 1]} ${p[0]}`;
}
// Безопасный мини-markdown: всё экранируется, потом размечаются абзацы, **жирный**, [ссылки](https://…), списки «- » и заголовки «## ».
export function renderRich(text) {
  const inline = (t) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return String(text ?? '').replace(/\r\n?/g, '\n').split(/\n{2,}/).map((blk) => {
    const lines = blk.split('\n').filter((l) => l.trim());
    if (!lines.length) return '';
    const im = lines.length === 1 && lines[0].trim().match(/^!\[([^\]]*)\]\(([^\s)]+)\)$/);
    if (im) {
      const src = im[2];
      if (!(/^https:\/\//i.test(src) || /^assets\/news\/[\w@./-]+$/.test(src)) || src.includes('..')) return '';
      return `<figure class="news-fig"><img src="${esc(src)}" alt="${esc(im[1])}" loading="lazy"></figure>`;
    }
    if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) return '<ul>' + lines.map((l) => `<li>${inline(l.replace(/^\s*[-•*]\s+/, ''))}</li>`).join('') + '</ul>';
    if (/^#{1,3}\s+/.test(lines[0])) {
      const rest = lines.slice(1).join('\n');
      return `<h3>${inline(lines[0].replace(/^#{1,3}\s+/, ''))}</h3>` + (rest ? renderRich(rest) : '');
    }
    return '<p>' + lines.map(inline).join('<br>') + '</p>';
  }).join('');
}
export function safeUrl(u) { return /^(https?:\/\/|assets\/)/i.test(String(u || '').trim()) ? String(u).trim() : ''; }
