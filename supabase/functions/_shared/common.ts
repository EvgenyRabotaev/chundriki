import { createClient } from 'npm:@supabase/supabase-js@2';

export const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const TOKEN = Deno.env.get('DISCORD_BOT_TOKEN')!;
export const ROLE_NAME = 'чундрики';
export const CHANNEL_NAME = 'регистрация';

export async function discord(path: string, method = 'GET', body?: unknown) {
  const res = await fetch('https://discord.com/api/v10' + path, {
    method,
    headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 429) { // один повтор после паузы
    const j = await res.json().catch(() => ({ retry_after: 1 }));
    await new Promise((r) => setTimeout(r, Math.ceil((j.retry_after ?? 1) * 1000)));
    return discord(path, method, body);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw Object.assign(new Error(`Discord ${method} ${path}: ${res.status} ${text.slice(0, 200)}`), { status: res.status });
  return data;
}

export async function getConfig(key: string): Promise<string | null> {
  const { data } = await sb.from('bot_config').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}
export async function setConfig(key: string, value: string) {
  await sb.from('bot_config').upsert({ key, value, updated_at: new Date().toISOString() });
}

export const REGISTER_BUTTON = {
  type: 1,
  components: [{ type: 2, style: 1, label: 'Указать ник', emoji: { name: '🐾' }, custom_id: 'register' }],
};

export type DUser = { id: string; username: string; global_name?: string | null };
export const displayName = (u: DUser, nick?: string | null) => nick || u.global_name || u.username;
const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

export type SiteMember = { id: number; game_nick: string; discord_nick: string | null; discord_id: string | null };

// Привязать человека с ролью «Чундрики» к сайту: найти существующую запись или создать новую.
// reg — его анкета (игровой ник, имя). Возвращает, что сделали.
export async function linkOrCreate(
  user: DUser, nick: string | null | undefined,
  reg: { game_nick: string; real_name?: string | null } | null,
  site: SiteMember[],
): Promise<string> {
  const display = displayName(user, nick);
  const names = [nick, user.global_name, user.username].map(norm).filter(Boolean);
  let m = site.find((x) => x.discord_id === user.id);
  if (m) {
    const upd: Record<string, unknown> = {};
    if (m.discord_nick !== display) upd.discord_nick = display;
    if (reg && norm(reg.game_nick) !== norm(m.game_nick)) upd.game_nick = reg.game_nick;
    if (reg?.real_name) upd.real_name = reg.real_name;
    if (Object.keys(upd).length) { await sb.from('members').update(upd).eq('id', m.id); Object.assign(m, upd); return 'updated'; }
    return 'same';
  }
  // совпадение по Discord-нику или по игровому нику из анкеты, только среди записей без ID
  m = site.find((x) => !x.discord_id && (
    (x.discord_nick && names.includes(norm(x.discord_nick))) || (reg && norm(x.game_nick) === norm(reg.game_nick))));
  if (m) {
    const upd: Record<string, unknown> = { discord_id: user.id, discord_nick: display };
    if (reg?.real_name) upd.real_name = reg.real_name;
    await sb.from('members').update(upd).eq('id', m.id);
    Object.assign(m, upd);
    return 'linked';
  }
  if (!reg) return 'none';
  const { data, error } = await sb.from('members').insert({
    game_nick: reg.game_nick, real_name: reg.real_name || null, discord_id: user.id, discord_nick: display,
    clan_role: 'чундрик', joined_at: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }), // дата по Москве
  }).select('id, game_nick, discord_nick, discord_id').single();
  if (error) throw new Error('insert member: ' + error.message);
  site.push(data);
  return 'created';
}
