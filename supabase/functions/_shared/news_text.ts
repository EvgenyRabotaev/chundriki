// Общий разбор текста новости для Telegram/Discord: тело бывает мини-markdown (старые/авто-новости)
// или HTML из визуального редактора админки.
export const isHtml = (body: string) => /^\s*</.test(body) || /<\/?(p|h[1-6]|div|br|ul|ol|li|blockquote)\b/i.test(body);

const decode = (s: string) => s
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

// первый текстовый абзац без разметки, не длиннее max символов
export function teaser(body: string, max = 300) {
  let paras: string[];
  if (isHtml(body)) {
    paras = body.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .split(/<\/p>|<br\s*\/?>|<\/h[1-6]>|<\/li>|<\/blockquote>|<hr\s*\/?>/i)
      .filter((p) => !/<h[1-6]\b/i.test(p))
      .map((p) => decode(p.replace(/<[^>]*>/g, '')).trim());
  } else {
    paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => !p.startsWith('#') && !p.startsWith('!'));
  }
  let t = (paras.find((p) => p) ?? '').replace(/\*\*|__|~~|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return t;
}

// картинка для поста: обложка, а если её нет — первая картинка из текста. Относительные пути — от сайта.
export function postImage(imageUrl: string | null, body: string, site: string): string | null {
  let src = imageUrl || '';
  if (!src) {
    const m = body.match(/<img\b[^>]*\bsrc="([^"]+)"/i) || body.match(/!\[[^\]]*\]\(([^\s)]+)\)/);
    src = m ? decode(m[1]) : '';
  }
  if (!src) return null;
  try {
    const u = new URL(src, site);
    return u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}
