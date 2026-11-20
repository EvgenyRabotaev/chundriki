// Синхронизация с Discord по расписанию (pg_cron, каждые 5 минут).
import { sb, discord, getConfig, setConfig, linkOrCreate, displayName, REGISTER_BUTTON, ROLE_NAME, CHANNEL_NAME, type SiteMember } from '../_shared/common.ts';

const SECRET = Deno.env.get('SYNC_SECRET')!;
const MAX_PINGS = 10; // не больше упоминаний за один запуск

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get('x-sync-secret') !== SECRET) return new Response('forbidden', { status: 403 });
  try { return Response.json(await run()); }
  catch (e) { console.error(e); return Response.json({ status: 'error', message: String((e as Error).message).slice(0, 300) }, { status: 500 }); }
});

async function run() {
  const guilds = await discord('/users/@me/guilds');
  if (!guilds.length) return { status: 'no guild' };
  let guildId = await getConfig('guild_id');
  if (!guildId || !guilds.some((g: any) => g.id === guildId)) { guildId = guilds[0].id; await setConfig('guild_id', guildId!); }
  let installedAt = await getConfig('installed_at');
  if (!installedAt) { installedAt = new Date().toISOString(); await setConfig('installed_at', installedAt); }

  // роль и канал ищем по имени (кэш обновляем при каждом запуске, это дёшево)
  const roles = await discord(`/guilds/${guildId}/roles`);
  // managed-роли (роль самого бота «Чундрики» и т.п.) пропускаем
  const human = roles.filter((r: any) => !r.managed);
  const role = human.find((r: any) => r.name.toLowerCase() === ROLE_NAME) ?? human.find((r: any) => r.name.toLowerCase().includes(ROLE_NAME));
  const channels = await discord(`/guilds/${guildId}/channels`);
  // канал можно задать вручную (bot_config.channel_override), иначе ищем по имени
  const override = await getConfig('channel_override');
  const channel = (override && channels.find((c: any) => c.id === override)) || channels.find((c: any) => c.type === 0 && c.name.toLowerCase().includes(CHANNEL_NAME));
  if (role) await setConfig('role_id', role.id);
  if (channel) await setConfig('channel_id', channel.id);

  // все участники сервера
  const members: any[] = [];
  for (let after = '0'; ;) {
    const page = await discord(`/guilds/${guildId}/members?limit=1000&after=${after}`);
    members.push(...page);
    if (page.length < 1000) break;
    after = page[page.length - 1].user.id;
  }
  const humans = members.filter((m) => !m.user.bot);
  const out: Record<string, unknown> = { status: 'ok', guild_members: humans.length, role: !!role, channel: !!channel };

  // закреплённое сообщение с кнопкой
  if (channel && !(await getConfig('pinned_message_id'))) {
    const msg = await discord(`/channels/${channel.id}/messages`, 'POST', {
      content: '## 🐾 Новенький? Нажми кнопку и укажи игровой ник\nТак ты появишься на сайте клана, а твой Discord станет ссылкой на профиль. Ошибся в нике? Нажми кнопку ещё раз и исправь.',
      components: [REGISTER_BUTTON],
    });
    await setConfig('pinned_message_id', msg.id);
    try { await discord(`/channels/${channel.id}/pins/${msg.id}`, 'PUT'); out.pinned = true; } catch (e) { out.pin_error = String((e as Error).message).slice(0, 120); }
  }

  const { data: regsRaw } = await sb.from('discord_registrations').select('discord_id, game_nick, real_name');
  const regs = new Map((regsRaw ?? []).map((r) => [r.discord_id, r]));

  // новички: тегаем в #регистрация (только тех, кто зашёл после установки бота)
  if (channel) {
    const { data: pinged } = await sb.from('discord_pings').select('discord_id');
    const done = new Set((pinged ?? []).map((p) => p.discord_id));
    const fresh = humans.filter((m) => m.joined_at && m.joined_at > installedAt! && !regs.has(m.user.id) && !done.has(m.user.id)).slice(0, MAX_PINGS);
    for (const m of fresh) {
      await discord(`/channels/${channel.id}/messages`, 'POST', {
        content: `Привет, <@${m.user.id}>! 🐾 Добро пожаловать в семью Чундриков! Нажми кнопку ниже и впиши свой игровой ник, чтобы мы знали, кого именно сегодня переворачивать на УАЗике.`,
        components: [REGISTER_BUTTON], allowed_mentions: { users: [m.user.id] },
      });
      await sb.from('discord_pings').upsert({ discord_id: m.user.id });
    }
    out.pinged = fresh.length;
  }

  // синхронизация с сайтом возможна, только если нашли роль
  if (!role) return { ...out, note: 'role not found, site sync skipped' };
  const holders = humans.filter((m) => m.roles.includes(role.id));
  const { data: siteRaw } = await sb.from('members').select('id, game_nick, discord_nick, discord_id, clan_role, real_name, joined_at');
  const site = (siteRaw ?? []) as (SiteMember & Record<string, unknown>)[];
  const stats: Record<string, number> = {};
  for (const m of holders) {
    const r = await linkOrCreate(m.user, m.nick, regs.get(m.user.id) ?? null, site);
    stats[r] = (stats[r] ?? 0) + 1;
  }
  out.holders = holders.length; out.site = stats;

  // ушедшие / потерявшие роль: только записи с discord_id, и только если список ролей выглядит здраво
  const holderIds = new Set(holders.map((m) => m.user.id));
  let moved = 0;
  if (holders.length > 0) {
    for (const s of site.filter((x) => x.discord_id && !holderIds.has(x.discord_id))) {
      const inGuild = humans.some((m) => m.user.id === s.discord_id);
      const { error } = await sb.from('former_members').insert({
        game_nick: s.game_nick, discord_nick: s.discord_nick, discord_id: s.discord_id, clan_role: s.clan_role,
        real_name: s.real_name, joined_at: s.joined_at, left_at: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }), leave_type: 'ушёл сам',
        reason: inGuild ? 'Автоматически: снята роль «Чундрики»' : 'Автоматически: вышел с сервера',
      });
      if (error) { console.error('former insert', error.message); continue; }
      await sb.from('members').delete().eq('id', s.id);
      moved++;
    }
  }
  out.moved_to_former = moved;

  // записи без Discord ID не трогаем, только отчёт для ручного разбора
  const unmatched = site.filter((x) => !x.discord_id);
  await sb.from('bot_sync_report').delete().eq('kind', 'no_discord_id');
  if (unmatched.length) {
    await sb.from('bot_sync_report').insert(unmatched.map((x) => ({
      kind: 'no_discord_id', member_id: x.id, game_nick: x.game_nick,
      details: `Не найден на сервере среди участников с ролью (Discord-ник на сайте: ${x.discord_nick ?? '—'})`,
    })));
  }
  out.unmatched = unmatched.length;
  return out;
}
