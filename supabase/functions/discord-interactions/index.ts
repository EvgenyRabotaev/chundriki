// Точка приёма Discord Interactions: кнопка «Указать ник» и форма «Анкета Чундрика».
import nacl from 'npm:tweetnacl@1';
import { sb, discord, getConfig, linkOrCreate, type SiteMember } from '../_shared/common.ts';

const PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY')!;
const hex = (s: string) => Uint8Array.from(s.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const say = (content: string) => json({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } });

function verified(sig: string | null, ts: string | null, body: string) {
  if (!sig || !ts) return false;
  try { return nacl.sign.detached.verify(new TextEncoder().encode(ts + body), hex(sig), hex(PUBLIC_KEY)); } catch { return false; }
}

const input = (id: string, label: string, required: boolean, max: number, value?: string, placeholder?: string) => ({
  type: 1, components: [{ type: 4, custom_id: id, label, style: 1, required, max_length: max, ...(value ? { value } : {}), ...(placeholder ? { placeholder } : {}) }],
});

export async function handle(i: any) {
  if (i.type === 1) return json({ type: 1 });
  const user = i.member?.user ?? i.user;
  if (!user) return say('Не вижу, кто ты. Попробуй ещё раз на сервере.');

  if (i.type === 3 && i.data?.custom_id === 'register') {
    const { data: reg } = await sb.from('discord_registrations').select('game_nick, real_name').eq('discord_id', user.id).maybeSingle();
    return json({ type: 9, data: { custom_id: 'register_modal', title: 'Анкета Чундрика', components: [
      input('game_nick', 'Игровой ник в PUBG', true, 32, reg?.game_nick, 'Например: Marusabelle'),
      input('real_name', 'Имя (по желанию)', false, 64, reg?.real_name ?? undefined),
    ] } });
  }

  if (i.type === 5 && i.data?.custom_id === 'register_modal') {
    const vals: Record<string, string> = {};
    for (const row of i.data.components ?? []) for (const c of row.components ?? []) vals[c.custom_id] = String(c.value ?? '').trim();
    const game_nick = (vals.game_nick ?? '').slice(0, 32);
    const real_name = (vals.real_name ?? '').slice(0, 64) || null;
    if (!game_nick) return say('Игровой ник пустой. Нажми кнопку ещё раз и впиши ник.');
    const { error } = await sb.from('discord_registrations').upsert({
      discord_id: user.id, game_nick, real_name, discord_username: user.username, registered_at: new Date().toISOString(),
    });
    if (error) { console.error(error.message); return say('Что-то пошло не так, Чундрик задумался. Попробуй ещё раз через минуту.'); }
    const roleId = await getConfig('role_id');
    let onSite = false;
    if (roleId && (i.member?.roles ?? []).includes(roleId)) {
      const { data: site } = await sb.from('members').select('id, game_nick, discord_nick, discord_id');
      await linkOrCreate(user, i.member?.nick, { game_nick, real_name }, (site ?? []) as SiteMember[]);
      onSite = true;
    }
    // уведомление в канал регистрации: кто и какой ник указал (чтобы добавить в игре)
    try {
      const ch = await getConfig('channel_id');
      if (ch) await discord(`/channels/${ch}/messages`, 'POST', {
        content: `📝 <@${user.id}> заполнил анкету.\nИгровой ник: **${game_nick}**${real_name ? `\nИмя: ${real_name}` : ''}${onSite ? '\nУже есть роль, запись на сайте обновлена.' : '\nРоли «Чундрики» пока нет.'}`,
        allowed_mentions: { parse: [] },
      });
    } catch (e) { console.error('notify', (e as Error).message); }
    return say(onSite
      ? `🐾 Готово, **${game_nick}**! Твоя запись на сайте обновлена. Добро пожаловать в семью!`
      : `🐾 Записали, **${game_nick}**! Как только тебе выдадут роль «Чундрики», ты сам появишься на сайте. Ничего вводить повторно не нужно. А пока береги бинты и не стой в синей зоне.`);
  }
  return say('Чундрик не понял, что от него хотят.');
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    const body = await req.text();
    if (!verified(req.headers.get('x-signature-ed25519'), req.headers.get('x-signature-timestamp'), body)) {
      return new Response('invalid request signature', { status: 401 });
    }
    try { return await handle(JSON.parse(body)); }
    catch (e) { console.error(e); return say('Ой, что-то сломалось. Попробуй ещё раз позже.'); }
  });
}
