// Разметка новости — общая для сайта и предпросмотра в админке
import { esc, fmtLong, safeUrl } from './util.js?v=33';
import { renderBody, bodyText } from './rich.js?v=33';

export function excerpt(body, n = 170) {
  const t = bodyText(body).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
}

export function newsDetailHtml(n, { back = true, comments = true } = {}) {
  const img = safeUrl(n.image_url), src = safeUrl(n.source_url);
  return `${back ? '<a class="back-link" href="news.html">← Все новости</a>' : ''}${n.status === 'draft' ? '<p class="draft-banner">📝 Черновик — ещё не опубликован, на сайте, в Telegram и Discord его не видно</p>' : ''}
    <time datetime="${esc(n.published_at)}">${esc(fmtLong(n.published_at))}</time>
    <h2 class="news-title">${esc(n.title)}</h2>
    ${img ? `<figure class="news-fig news-cover"><img src="${esc(img)}" alt="${esc(n.title)}">${img.startsWith('assets/news/') ? '<figcaption>Изображения: © KRAFTON / PUBG</figcaption>' : ''}</figure>` : ''}
    <div class="prose">${renderBody(n.body)}</div>
    ${src ? `<p class="news-source">Источник: <a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${esc(n.source_name || src)} ↗</a></p>` : ''}
    ${comments ? '<section class="comments" id="comments"></section>' : ''}`;
}
