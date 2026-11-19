// Единый слой доступа к данным. Если когда-нибудь поменяем бэкенд,
// достаточно переписать этот файл — остальной сайт работает только через эти функции.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const MEMBER_COLS = 'id, game_nick, discord_nick, discord_id, clan_role, joined_at, real_name';
const FORMER_COLS = 'id, game_nick, discord_nick, discord_id, clan_role, real_name, joined_at, left_at, leave_type, reason';
const VIDEO_COLS = 'id, title, url, platform, short_desc, long_desc, sort_order, created_at';

const ROLE_ORDER = { 'лидер': 0, 'админ': 1, 'боец': 2 };

function unwrap({ data, error }) {
  if (error) throw new Error(error.message || String(error));
  return data;
}

function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id') continue;
    out[k] = typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v;
  }
  return out;
}

// ---------- Публичное чтение ----------
export async function getMembers() {
  const rows = unwrap(await sb.from('members').select(MEMBER_COLS));
  return rows.sort((a, b) =>
    (ROLE_ORDER[a.clan_role] ?? 9) - (ROLE_ORDER[b.clan_role] ?? 9) ||
    String(a.joined_at || '').localeCompare(String(b.joined_at || '')) ||
    a.game_nick.localeCompare(b.game_nick));
}

export async function getVideos() {
  return unwrap(await sb.from('videos').select(VIDEO_COLS)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: false }));
}

// ---------- Авторизация ----------
export async function sendMagicLink(email, redirectTo) {
  unwrap(await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
  }));
}
export async function getSession() {
  return unwrap(await sb.auth.getSession()).session;
}
export function onAuthChange(cb) {
  return sb.auth.onAuthStateChange((_event, session) => cb(session));
}
export async function signOut() { await sb.auth.signOut(); }
export async function isAdmin() {
  return !!unwrap(await sb.rpc('is_admin'));
}

// ---------- Админка: состав ----------
export async function createMember(m) { return unwrap(await sb.from('members').insert(clean(m)).select(MEMBER_COLS).single()); }
export async function updateMember(id, m) { return unwrap(await sb.from('members').update(clean(m)).eq('id', id).select(MEMBER_COLS).single()); }
export async function deleteMember(id) { unwrap(await sb.from('members').delete().eq('id', id)); }
export async function moveToFormer(id, leaveType, reason, leftAt) {
  unwrap(await sb.rpc('move_to_former', {
    p_member_id: id, p_leave_type: leaveType, p_reason: reason || null,
    p_left_at: leftAt || new Date().toISOString().slice(0, 10),
  }));
}

// ---------- Админка: ушедшие ----------
export async function getFormerMembers() {
  return unwrap(await sb.from('former_members').select(FORMER_COLS).order('left_at', { ascending: false }));
}
export async function createFormer(m) { return unwrap(await sb.from('former_members').insert(clean(m)).select(FORMER_COLS).single()); }
export async function updateFormer(id, m) { return unwrap(await sb.from('former_members').update(clean(m)).eq('id', id).select(FORMER_COLS).single()); }
export async function deleteFormer(id) { unwrap(await sb.from('former_members').delete().eq('id', id)); }

// ---------- Админка: видео ----------
export async function createVideo(v) { return unwrap(await sb.from('videos').insert(clean(v)).select(VIDEO_COLS).single()); }
export async function updateVideo(id, v) { return unwrap(await sb.from('videos').update(clean(v)).eq('id', id).select(VIDEO_COLS).single()); }
export async function deleteVideo(id) { unwrap(await sb.from('videos').delete().eq('id', id)); }
