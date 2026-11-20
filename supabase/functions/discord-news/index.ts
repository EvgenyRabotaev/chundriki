// Публикация опубликованной новости сайта в Discord-канал (bot_config.discord_news_channel_id).
// Вызывается тем же триггером, что и telegram-news, с телом {"id": N}.
import { sb, getConfig, discord } from '../_shared/common.ts';
import { teaser, postImage } from '../_shared/news_text.ts';

const SECRET = Deno.env.get('SYNC_SECRET')!;
const SITE = 'https://chundriki.top/';

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get('x-sync-secret') !== SECRET) return new Response('forbidden', { status: 403 });
  try {
    const { id } = await req.json();
    const channel = await getConfig('discord_news_channel_id');
    if (!channel) return Response.json({ status: 'no channel' });
    const { data: n } = await sb.from('news').select('id, title, body, image_url, status').eq('id', id).single();
    if (!n) return Response.json({ status: 'no news' });
    if (n.status !== 'published') return Response.json({ status: 'draft, skipped' });
    const link = `${SITE}news.html?id=${n.id}`;
    const embed: Record<string, unknown> = {
      title: `🪖 ${n.title}`.slice(0, 256),
      url: link,
      description: `${teaser(n.body ?? '')}\n\n👉 [Читать на сайте Чундриков](${link})`,
      color: 0x8a9a5b,
    };
    const img = postImage(n.image_url, n.body ?? '', SITE);
    if (img) embed.image = { url: img };
    const r = await discord(`/channels/${channel}/messages`, 'POST', { embeds: [embed], allowed_mentions: { parse: [] } });
    return Response.json({ status: r?.id ? 'sent' : 'error', error: r?.id ? undefined : JSON.stringify(r).slice(0, 300) });
  } catch (e) {
    return Response.json({ status: 'error', message: String((e as Error).message).slice(0, 300) }, { status: 500 });
  }
});
