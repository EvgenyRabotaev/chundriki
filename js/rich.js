// Текст новостей: старый мини-markdown или HTML из визуального редактора.
// HTML всегда проходит через строгий белый список — и на сайте, и в редакторе.
import { esc, renderRich } from './util.js?v=27';

export const isHtmlBody = (body) => /^\s*</.test(String(body ?? ''));

const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH', 'NOSCRIPT', 'TEXTAREA', 'SELECT', 'BUTTON', 'INPUT', 'FORM', 'LINK', 'META', 'TITLE', 'HEAD', 'VIDEO', 'AUDIO', 'CANVAS', 'FRAME', 'FRAMESET']);
const RENAME = { B: 'strong', I: 'em', STRIKE: 's', DEL: 's', DIV: 'p', H1: 'h2', H4: 'h3', H5: 'h3', H6: 'h3', FONT: 'span' };
const ALLOWED = new Set(['p', 'h2', 'h3', 'strong', 'em', 's', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br', 'img', 'span', 'figure', 'figcaption']);
const BLOCK_ALIGN = new Set(['p', 'h2', 'h3', 'li', 'blockquote', 'figure', 'figcaption']);
const IMG_ALIGN = ['img-left', 'img-center', 'img-right'];

export function safeHref(u) {
  const s = String(u || '').trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : '';
}
export function safeImgSrc(u) {
  const s = String(u || '').trim();
  if (s.includes('..')) return '';
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  if (/^assets\/news\/[\w@./-]+$/.test(s)) return s;
  return '';
}
function cssColor(v) {
  v = String(v || '').trim().toLowerCase();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(v)) return v;
  const m = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/);
  if (m && [m[1], m[2], m[3]].every((x) => +x <= 255)) return '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('');
  return '';
}
function readStyle(el) {
  const out = {};
  const st = el.getAttribute('style') || '';
  for (const part of st.split(';')) {
    const i = part.indexOf(':'); if (i < 0) continue;
    out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

// Чистит HTML: оставляет только разрешённые теги/атрибуты/стили, остальное выкидывает или разворачивает в текст.
export function sanitizeHtml(html) {
  const src = new DOMParser().parseFromString(`<body>${String(html ?? '')}</body>`, 'text/html');
  const doc = document.implementation.createHTMLDocument('');
  const out = doc.createElement('div');
  const walk = (from, to) => {
    for (const node of [...from.childNodes]) {
      if (node.nodeType === 3) { to.appendChild(doc.createTextNode(node.nodeValue)); continue; }
      if (node.nodeType !== 1) continue;
      const T = node.tagName.toUpperCase();
      if (DROP.has(T)) continue;
      const tag = RENAME[T] || T.toLowerCase();
      if (!ALLOWED.has(tag)) { walk(node, to); continue; }
      const st = readStyle(node);
      let el;
      if (tag === 'img') {
        const s = safeImgSrc(node.getAttribute('src'));
        if (!s) continue;
        el = doc.createElement('img');
        el.setAttribute('src', s);
        el.setAttribute('alt', (node.getAttribute('alt') || '').slice(0, 300));
        el.setAttribute('loading', 'lazy');
        const al = IMG_ALIGN.find((c) => node.classList.contains(c));
        if (al) el.className = al;
        const w = String(st.width || '').match(/^(\d{1,3}(?:\.\d+)?)%$/);
        if (w && +w[1] >= 5 && +w[1] <= 100) el.setAttribute('style', `width: ${Math.round(+w[1] * 10) / 10}%`);
        to.appendChild(el); continue;
      }
      el = doc.createElement(tag);
      if (tag === 'a') {
        const h = safeHref(node.getAttribute('href'));
        if (!h) { walk(node, to); continue; }
        el.setAttribute('href', h); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer');
      }
      const styles = [];
      const align = (st['text-align'] || node.getAttribute('align') || '').toLowerCase();
      if (BLOCK_ALIGN.has(tag) && ['left', 'center', 'right', 'justify'].includes(align) && align !== 'left') styles.push(`text-align: ${align}`);
      if (['span', 'strong', 'em', 's', 'u', 'p', 'li', 'h2', 'h3'].includes(tag)) {
        const c = cssColor(st.color || (T === 'FONT' ? node.getAttribute('color') : ''));
        if (c) styles.push(`color: ${c}`);
      }
      if (styles.length) el.setAttribute('style', styles.join('; '));
      if (tag === 'figure') el.className = 'news-fig';
      if (tag === 'span' && !styles.length) { walk(node, to); continue; }
      walk(node, el);
      if (tag !== 'br' && tag !== 'hr' && ['span', 'strong', 'em', 's', 'u', 'a'].includes(tag) && !el.childNodes.length) continue;
      to.appendChild(el);
    }
  };
  walk(src.body, out);
  return out.innerHTML;
}

// Тело новости для показа на сайте
export function renderBody(body) {
  return isHtmlBody(body) ? sanitizeHtml(body) : renderRich(body);
}

// Плоский текст (для карточек и подсказок)
export function bodyText(body) {
  const s = String(body ?? '');
  if (!isHtmlBody(s)) return s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/[#*>\[\]]|\(https?:[^)]*\)/g, '').replace(/^\s*[-•]\s+/gm, '');
  const d = new DOMParser().parseFromString(s.replace(/<\/(p|h2|h3|li|blockquote|figcaption)>|<br\s*\/?>/gi, '$& '), 'text/html');
  return d.body.textContent || '';
}

// Для редактора: markdown превращаем в эквивалентный HTML
export function toEditorHtml(body) {
  let html = isHtmlBody(body) ? sanitizeHtml(body) : renderRich(body);
  html = html.replace(/<figure class="news-fig"><img ([^>]*?)><\/figure>/g, (m, attrs) => `<p><img ${attrs} class="img-center" style="width: 100%"></p>`);
  return sanitizeHtml(html) || '<p><br></p>';
}
export { esc };
