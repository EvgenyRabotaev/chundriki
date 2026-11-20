// Визуальный редактор текста новости: contenteditable + панель иконок + изменение размера картинок.
// Результат всегда проходит через sanitizeHtml.
import { sanitizeHtml, safeHref, safeImgSrc } from './rich.js?v=27';

const I = (d, extra = '') => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const T = (txt) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-family="Rubik, sans-serif" font-weight="700" font-size="13" fill="currentColor">${txt}</text></svg>`;
export const ICONS = {
  h2: T('H2'), h3: T('H3'),
  bold: I('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z"/>', 'stroke-width="2.6"'),
  italic: I('<path d="M19 4h-9M14 20H5M15 4 9 20"/>'),
  strike: I('<path d="M4 12h16"/><path d="M16 6.5C15.3 5 13.8 4 12 4c-2.5 0-4.5 1.5-4.5 3.6 0 1.6 1 2.6 3 3.4M8 17.5c.7 1.5 2.2 2.5 4 2.5 2.5 0 4.5-1.5 4.5-3.6 0-.8-.3-1.5-.8-2"/>'),
  underline: I('<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>'),
  left: I('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
  center: I('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
  right: I('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
  color: I('<path d="M5 18 12 4l7 14M8 12.5h8"/>'),
  ul: I('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>'),
  ol: I('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5l1.5-1v5M3.5 13.5c.3-.9 2.5-1 2.5.3 0 1-2.5 1.7-2.5 3.2H6" stroke-width="1.5"/>'),
  quote: I('<path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6"/>'),
  link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  image: I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>'),
  hr: I('<path d="M3 12h18"/><path d="M8 6h8M8 18h8" stroke-width="1.2" opacity=".5"/>'),
  clear: I('<path d="M6 4h12M12 4l-4 16M15 14l6 6M21 14l-6 6"/>'),
  undo: I('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  redo: I('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  upload: I('<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>'),
  alt: I('<path d="M4 7V5h16v2M12 5v14M9 19h6"/>'),
};
export const COLORS = [
  ['', 'Обычный'], ['#c8b98a', 'Песочный'], ['#ff6fae', 'Розовый'], ['#8a9a4b', 'Оливковый'],
  ['#3d8bff', 'Синий'], ['#ff5a5a', 'Красный'], ['#ffa54a', 'Оранжевый'], ['#ffd84a', 'Жёлтый'], ['#ffffff', 'Белый'], ['#9aa09a', 'Серый'],
];

const TOOLS = [
  ['undo', 'Отменить (Ctrl+Z)'], ['redo', 'Повторить (Ctrl+Y)'], '|',
  ['h2', 'Заголовок'], ['h3', 'Подзаголовок'], '|',
  ['bold', 'Жирный (Ctrl+B)'], ['italic', 'Курсив (Ctrl+I)'], ['underline', 'Подчёркнутый (Ctrl+U)'], ['strike', 'Зачёркнутый'], ['color', 'Цвет текста'], '|',
  ['left', 'По левому краю'], ['center', 'По центру'], ['right', 'По правому краю'], '|',
  ['ul', 'Маркированный список'], ['ol', 'Нумерованный список'], ['quote', 'Цитата'], '|',
  ['link', 'Ссылка'], ['image', 'Картинка'], ['hr', 'Разделитель'], '|',
  ['clear', 'Очистить форматирование'],
];
const BLOCKS = 'p,h2,h3,li,blockquote,figure';

/**
 * @param {HTMLElement} root  контейнер, внутрь которого строится редактор
 * @param {{html:string, upload:(file:File)=>Promise<string>, onChange?:()=>void, toast?:(m:string,e?:boolean)=>void}} opts
 */
export function createEditor(root, opts) {
  const say = opts.toast || ((m) => alert(m));
  root.classList.add('rte');
  root.innerHTML = `<div class="rte-bar" role="toolbar" aria-label="Форматирование">${TOOLS.map((t) => t === '|' ? '<span class="rte-sep"></span>'
    : `<button type="button" class="rte-btn" data-cmd="${t[0]}" title="${t[1]}" aria-label="${t[1]}">${ICONS[t[0]]}${t[0] === 'color' ? '<i class="rte-swatch"></i>' : ''}</button>`).join('')}
    <div class="rte-pop rte-colors" hidden>${COLORS.map(([c, n]) => `<button type="button" data-color="${c}" title="${n}" aria-label="${n}" style="${c ? `background:${c}` : ''}" class="${c ? '' : 'rte-nocolor'}"></button>`).join('')}</div>
    <div class="rte-pop rte-imgmenu" hidden><button type="button" data-img="file">${ICONS.upload}<span>С компьютера</span></button><button type="button" data-img="url">${ICONS.link}<span>По ссылке</span></button></div>
  </div>
  <div class="rte-scroll"><div class="rte-area prose" contenteditable="true" spellcheck="true" aria-label="Текст новости"></div>
    <div class="rte-imgbox" hidden>
      <span class="h nw" data-h="nw"></span><span class="h ne" data-h="ne"></span><span class="h sw" data-h="sw"></span><span class="h se" data-h="se"></span>
      <div class="rte-imgbar">
        <button type="button" data-ia="img-left" title="Слева, текст обтекает">${ICONS.left}</button>
        <button type="button" data-ia="img-center" title="По центру">${ICONS.center}</button>
        <button type="button" data-ia="img-right" title="Справа, текст обтекает">${ICONS.right}</button>
        <span class="rte-sep"></span>
        ${[25, 50, 75, 100].map((w) => `<button type="button" data-iw="${w}" title="Ширина ${w}%">${w}%</button>`).join('')}
        <span class="rte-sep"></span>
        <button type="button" data-ia="alt" title="Подпись для картинки (alt)">${ICONS.alt}</button>
        <button type="button" data-ia="del" title="Удалить картинку">${ICONS.trash}</button>
        <span class="rte-size"></span>
      </div>
    </div>
  </div>
  <input type="file" accept="image/*" class="rte-file" hidden>`;
  const bar = root.querySelector('.rte-bar'), area = root.querySelector('.rte-area'), scroll = root.querySelector('.rte-scroll');
  const box = root.querySelector('.rte-imgbox'), sizeEl = root.querySelector('.rte-size'), fileIn = root.querySelector('.rte-file');
  const colors = root.querySelector('.rte-colors'), imgMenu = root.querySelector('.rte-imgmenu');
  area.innerHTML = opts.html || '<p><br></p>';
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}

  let saved = null; // последняя позиция курсора внутри редактора
  const inArea = (n) => n && area.contains(n.nodeType === 1 ? n : n.parentNode);
  const saveSel = () => { const s = getSelection(); if (s.rangeCount && inArea(s.anchorNode)) saved = s.getRangeAt(0).cloneRange(); };
  const restoreSel = () => { area.focus({ preventScroll: true }); if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); } };
  const changed = () => { opts.onChange?.(); syncState(); };
  const exec = (cmd, val = null) => { restoreSel(); document.execCommand(cmd, false, val); saveSel(); changed(); };

  function blocksInSelection() {
    const s = getSelection(); if (!s.rangeCount) return [];
    const r = s.getRangeAt(0);
    const startB = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest(BLOCKS);
    const all = [...area.querySelectorAll(BLOCKS)].filter((b) => r.intersectsNode(b) && !b.querySelector(BLOCKS.replace('li,', '')));
    if (startB && area.contains(startB) && !all.includes(startB)) all.push(startB);
    return all.filter((b) => area.contains(b));
  }
  function curBlockTag() {
    const s = getSelection(); if (!s.rangeCount || !inArea(s.anchorNode)) return '';
    const el = (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('h2,h3,blockquote,p,li');
    return el && area.contains(el) ? el.tagName.toLowerCase() : '';
  }
  function toggleBlock(tag) {
    restoreSel();
    const cur = curBlockTag();
    const inQuote = tag === 'blockquote' && getSelection().anchorNode?.parentElement?.closest('blockquote');
    document.execCommand('formatBlock', false, (cur === tag || inQuote) ? '<p>' : `<${tag}>`);
    saveSel(); changed();
  }
  function align(dir) {
    if (selImg) { setImgAlign(dir === 'left' ? 'img-left' : dir === 'right' ? 'img-right' : 'img-center'); return; }
    restoreSel();
    let bl = blocksInSelection();
    if (!bl.length) { document.execCommand('formatBlock', false, '<p>'); bl = blocksInSelection(); }
    bl.forEach((b) => { b.style.textAlign = dir === 'left' ? '' : dir; if (!b.getAttribute('style')) b.removeAttribute('style'); });
    saveSel(); changed();
  }
  function setColor(c) {
    restoreSel();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('foreColor', false, c || '#e7e6df');
    document.execCommand('styleWithCSS', false, false);
    if (!c) area.querySelectorAll('span[style*="color"], font[color]').forEach((sp) => {
      const col = sp.style.color || sp.getAttribute('color');
      if (/231,\s*230,\s*223|#e7e6df/i.test(col)) { sp.style.color = ''; sp.removeAttribute('color'); if (!sp.getAttribute('style')) sp.replaceWith(...sp.childNodes); }
    });
    saveSel(); changed();
  }
  function link() {
    restoreSel();
    const a = getSelection().anchorNode?.parentElement?.closest('a');
    const url = prompt('Ссылка (https://…). Пусто — убрать ссылку:', a?.getAttribute('href') || 'https://');
    if (url === null) return;
    if (!url.trim() || url.trim() === 'https://') { if (a) { const r = document.createRange(); r.selectNodeContents(a); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } document.execCommand('unlink'); changed(); return; }
    const h = safeHref(url);
    if (!h) { say('Ссылка должна начинаться с http:// или https://', true); return; }
    if (a) { a.setAttribute('href', h); changed(); return; }
    if (getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${h.replace(/"/g, '&quot;')}">${h.replace(/</g, '&lt;')}</a>`);
    else document.execCommand('createLink', false, h);
    saveSel(); changed();
  }
  function insertImage(src, alt = '') {
    restoreSel();
    const html = `<img src="${src.replace(/"/g, '&quot;')}" alt="${alt.replace(/"/g, '&quot;')}" class="img-center" style="width: 100%">`;
    const blk = curBlockTag();
    document.execCommand('insertHTML', false, blk && blk !== 'p' ? html : html);
    saveSel(); changed();
  }
  async function uploadFiles(files) {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      root.classList.add('busy');
      try { insertImage(await opts.upload(f)); } catch (e) { say('Не удалось загрузить картинку: ' + e.message, true); }
      finally { root.classList.remove('busy'); }
    }
  }

  // ---- панель ----
  const closePops = () => { colors.hidden = true; imgMenu.hidden = true; };
  const placePop = (pop, btn) => { pop.style.left = Math.min(btn.offsetLeft, bar.clientWidth - 230) + 'px'; pop.style.top = (btn.offsetTop + btn.offsetHeight + 4) + 'px'; };
  bar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); }); // не терять выделение
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.color !== undefined) { closePops(); setColor(b.dataset.color); bar.querySelector('.rte-swatch').style.background = b.dataset.color || ''; return; }
    if (b.dataset.img) { closePops(); if (b.dataset.img === 'file') fileIn.click(); else { const u = prompt('Адрес картинки (https://… или assets/news/…):', 'https://'); if (u && u.trim() !== 'https://') { const s = safeImgSrc(u); if (s) insertImage(s); else say('Нужна ссылка https://… или путь assets/news/…', true); } } return; }
    const cmd = b.dataset.cmd; if (!cmd) return;
    if (cmd !== 'color' && cmd !== 'image') closePops();
    switch (cmd) {
      case 'undo': case 'redo': exec(cmd); break;
      case 'h2': case 'h3': case 'quote': toggleBlock(cmd === 'quote' ? 'blockquote' : cmd); break;
      case 'bold': case 'italic': case 'underline': exec(cmd); break;
      case 'strike': exec('strikeThrough'); break;
      case 'left': case 'center': case 'right': align(cmd); break;
      case 'ul': exec('insertUnorderedList'); break;
      case 'ol': exec('insertOrderedList'); break;
      case 'hr': exec('insertHorizontalRule'); break;
      case 'link': link(); break;
      case 'clear': restoreSel(); document.execCommand('removeFormat'); document.execCommand('unlink'); blocksInSelection().forEach((x) => x.removeAttribute('style')); if (/^h[23]$|blockquote/.test(curBlockTag())) document.execCommand('formatBlock', false, '<p>'); saveSel(); changed(); break;
      case 'color': imgMenu.hidden = true; colors.hidden = !colors.hidden; placePop(colors, b); break;
      case 'image': colors.hidden = true; imgMenu.hidden = !imgMenu.hidden; placePop(imgMenu, b); break;
    }
  });
  document.addEventListener('mousedown', (e) => { if (!bar.contains(e.target)) closePops(); });
  fileIn.addEventListener('change', () => { uploadFiles([...fileIn.files]); fileIn.value = ''; });

  function syncState() {
    const q = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
    const tag = curBlockTag();
    const st = { bold: q('bold'), italic: q('italic'), underline: q('underline'), strike: q('strikeThrough'), ul: q('insertUnorderedList'), ol: q('insertOrderedList'), h2: tag === 'h2', h3: tag === 'h3', quote: !!getSelection().anchorNode?.parentElement?.closest?.('blockquote') };
    const s = getSelection(); const blk = s.anchorNode && inArea(s.anchorNode) ? (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest(BLOCKS) : null;
    const al = blk?.style.textAlign || 'left';
    st.left = al === 'left' || al === 'start' || !al; st.center = al === 'center'; st.right = al === 'right';
    bar.querySelectorAll('[data-cmd]').forEach((b) => b.classList.toggle('on', !!st[b.dataset.cmd]));
  }
  document.addEventListener('selectionchange', () => { if (inArea(getSelection().anchorNode)) { saveSel(); syncState(); } });

  // ---- вставка: только чистый HTML или картинки ----
  area.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); uploadFiles(files); return; }
    const html = e.clipboardData?.getData('text/html');
    if (html) { e.preventDefault(); document.execCommand('insertHTML', false, sanitizeHtml(html.replace(/<!--[\s\S]*?-->/g, ''))); changed(); }
  });
  area.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); const r = document.caretRangeFromPoint?.(e.clientX, e.clientY); if (r) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); saveSel(); } uploadFiles(files); }
  });
  area.addEventListener('input', () => { changed(); placeBox(); });
  area.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); } });

  // ---- картинки: выделение, ручки, выравнивание ----
  let selImg = null;
  function selectImg(img) {
    selImg = img; area.querySelectorAll('img.sel').forEach((x) => x.classList.remove('sel'));
    if (img) img.classList.add('sel');
    box.hidden = !img; placeBox();
  }
  function placeBox() {
    if (!selImg || !area.contains(selImg)) { if (selImg) selectImg(null); return; }
    const a = scroll.getBoundingClientRect(), r = selImg.getBoundingClientRect();
    Object.assign(box.style, { left: (r.left - a.left + scroll.scrollLeft) + 'px', top: (r.top - a.top + scroll.scrollTop) + 'px', width: r.width + 'px', height: r.height + 'px' });
    const al = ['img-left', 'img-center', 'img-right'].find((c) => selImg.classList.contains(c)) || 'img-center';
    box.querySelectorAll('[data-ia^="img-"]').forEach((b) => b.classList.toggle('on', b.dataset.ia === al));
    sizeEl.textContent = Math.round(pct(selImg)) + '%';
    box.classList.toggle('flip', r.top - a.top < 44);
  }
  const contentW = () => { const cs = getComputedStyle(area); return area.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); };
  const pct = (img) => { const w = parseFloat(img.style.width); return w || Math.min(100, img.getBoundingClientRect().width / contentW() * 100); };
  function setImgAlign(c) { if (!selImg) return; selImg.classList.remove('img-left', 'img-center', 'img-right'); selImg.classList.add(c); if (c !== 'img-center' && pct(selImg) > 60) selImg.style.width = '50%'; changed(); requestAnimationFrame(placeBox); }
  function setImgWidth(p) { if (!selImg) return; selImg.style.width = Math.max(10, Math.min(100, Math.round(p))) + '%'; placeBox(); }
  area.addEventListener('click', (e) => { const img = e.target.closest('img'); selectImg(img && area.contains(img) ? img : null); });
  area.addEventListener('keydown', (e) => {
    if (selImg && (e.key === 'Delete' || e.key === 'Backspace') && getSelection().isCollapsed) { e.preventDefault(); selImg.remove(); selectImg(null); changed(); }
    else if (selImg) selectImg(null);
  });
  scroll.addEventListener('scroll', placeBox);
  window.addEventListener('resize', placeBox);
  box.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !selImg) return;
    if (b.dataset.iw) { setImgWidth(+b.dataset.iw); changed(); return; }
    const a = b.dataset.ia;
    if (a === 'del') { selImg.remove(); selectImg(null); changed(); }
    else if (a === 'alt') { const t = prompt('Описание картинки (для поиска и слабовидящих):', selImg.alt || ''); if (t !== null) { selImg.alt = t.trim(); changed(); } }
    else setImgAlign(a);
  });
  box.addEventListener('pointerdown', (e) => {
    const h = e.target.dataset?.h; if (!h || !selImg) return;
    e.preventDefault();
    const startX = e.clientX, startW = selImg.getBoundingClientRect().width, cw = contentW();
    const centered = selImg.classList.contains('img-center');
    const sign = h.includes('w') ? -1 : 1;
    e.target.setPointerCapture(e.pointerId);
    const move = (ev) => setImgWidth((startW + sign * (ev.clientX - startX) * (centered ? 2 : 1)) / cw * 100);
    const up = () => { e.target.removeEventListener('pointermove', move); e.target.removeEventListener('pointerup', up); e.target.removeEventListener('pointercancel', up); changed(); };
    e.target.addEventListener('pointermove', move); e.target.addEventListener('pointerup', up); e.target.addEventListener('pointercancel', up);
  });
  area.addEventListener('load', placeBox, true);

  return {
    area,
    getHTML() {
      const c = area.cloneNode(true);
      c.querySelectorAll('img.sel').forEach((x) => x.classList.remove('sel'));
      let html = sanitizeHtml(c.innerHTML).replace(/<p>(\s|&nbsp;)*<\/p>/g, '').replace(/(<p><br><\/p>\s*)+$/g, '').trim();
      if (html && !html.startsWith('<')) html = `<p>${html}</p>`;
      return html;
    },
    isEmpty() { return !area.textContent.trim() && !area.querySelector('img,hr'); },
    focus() { area.focus(); },
  };
}
