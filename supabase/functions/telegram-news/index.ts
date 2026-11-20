// Публикация новой новости сайта в Telegram-группу клана.
// Вызывается триггером на insert в public.news (через pg_net) с телом {"id": N}.
import { sb, getConfig, setConfig } from '../_shared/common.ts';
import { teaser, postImage } from '../_shared/news_text.ts';

const SECRET = Deno.env.get('SYNC_SECRET')!;
const TG = `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}`;
const SITE = 'https://chundriki.top/';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function tg(method: string, body: unknown) {
  const r = await fetch(`${TG}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return await r.json();
}

// куда писать: из bot_config, а если не задано — ищем группу, куда бота добавили
async function chatId(): Promise<string | null> {
  const saved = await getConfig('tg_chat_id');
  if (saved) return saved;
  const u = await fetch(`${TG}/getUpdates`).then((r) => r.json());
  const chats = (u.result ?? []).flatMap((x: any) => [x.my_chat_member?.chat, x.message?.chat, x.channel_post?.chat]).filter((c: any) => c && c.type !== 'private');
  const c = chats.at(-1);
  if (!c) return null;
  await setConfig('tg_chat_id', String(c.id));
  return String(c.id);
}

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get('x-sync-secret') !== SECRET) return new Response('forbidden', { status: 403 });
  try {
    const { id } = await req.json();
    const chat = await chatId();
    if (!chat) return Response.json({ status: 'no chat' });
    const { data: n } = await sb.from('news').select('id, title, body, image_url, status').eq('id', id).single();
    if (!n) return Response.json({ status: 'no news' });
    if (n.status !== 'published') return Response.json({ status: 'draft, skipped' });
    const link = `${SITE}news.html?id=${n.id}`;
    const text = `🪖 <b>${esc(n.title)}</b>\n\n${esc(teaser(n.body ?? ''))}\n\n👉 <a href="${link}">Читать на сайте Чундриков</a>`;
    const img = postImage(n.image_url, n.body ?? '', SITE);
    let res = img ? await tg('sendPhoto', { chat_id: chat, photo: img, caption: text.slice(0, 1024), parse_mode: 'HTML' }) : null;
    if (!res?.ok) res = await tg('sendMessage', { chat_id: chat, text, parse_mode: 'HTML', link_preview_options: { url: link } });
    return Response.json({ status: res.ok ? 'sent' : 'error', error: res.ok ? undefined : res.description });
  } catch (e) {
    return Response.json({ status: 'error', message: String((e as Error).message).slice(0, 300) }, { status: 500 });
  }
});
