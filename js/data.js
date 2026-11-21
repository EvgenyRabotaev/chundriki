// Единый слой доступа к данным. Если когда-нибудь поменяем бэкенд,
// достаточно переписать этот файл — остальной сайт работает только через эти функции.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const MEMBER_COLS = 'id, game_nick, discord_nick, discord_id, clan_role, joined_at, real_name, sort_order';
const FORMER_COLS = 'id, game_nick, discord_nick, discord_id, clan_role, real_name, joined_at, left_at, leave_type, reason';
const VIDEO_COLS = 'id, title, url, platform, short_desc, long_desc, sort_order, created_at, tiktok_url, is_short, video_members(member_id)';

const ROLE_ORDER = { 'глава': 0, 'руководитель': 1, 'чундрик': 2 };

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
  // значки: отдельный запрос; если он упал, состав всё равно показываем
  const byMember = new Map();
  try {
    const mb = unwrap(await sb.from('member_badges').select('member_id, awarded_at, awarded_label, note, badges(id, slug, title, description, icon_url, emoji)'));
    for (const r of mb) {
      if (!r.badges) continue;
      if (!byMember.has(r.member_id)) byMember.set(r.member_id, []);
      byMember.get(r.member_id).push({ ...r.badges, awarded_at: r.awarded_at, awarded_label: r.awarded_label, note: r.note });
    }
  } catch (e) { console.warn('badges:', e.message); }
  for (const m of rows) m.badges = (byMember.get(m.id) || []).sort((a, b) => String(a.awarded_at || '').localeCompare(String(b.awarded_at || '')) || a.id - b.id);
  return rows.sort((a, b) =>
    (ROLE_ORDER[a.clan_role] ?? 9) - (ROLE_ORDER[b.clan_role] ?? 9) ||
    (a.sort_order ?? 100) - (b.sort_order ?? 100) ||
    a.game_nick.localeCompare(b.game_nick, 'en', { sensitivity: 'base', numeric: true }));
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
export async function signInDiscord(redirectTo) {
  unwrap(await sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo, scopes: 'identify email' } }));
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

// ---------- Комментарии к новостям ----------
export async function getComments(newsId) {
  return unwrap(await sb.from('news_comments').select('id, user_id, author_name, author_avatar, body, created_at').eq('news_id', newsId).order('created_at'));
}
export async function addComment(newsId, body) {
  return unwrap(await sb.from('news_comments').insert({ news_id: newsId, body }).select('id, user_id, author_name, author_avatar, body, created_at').single());
}
export async function deleteComment(id) { unwrap(await sb.from('news_comments').delete().eq('id', id)); }
export async function isChundrik() { return !!unwrap(await sb.rpc('is_chundrik')); }

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
async function setVideoMembers(id, ids) {
  unwrap(await sb.from('video_members').delete().eq('video_id', id));
  if (ids.length) unwrap(await sb.from('video_members').insert(ids.map((m) => ({ video_id: id, member_id: m }))));
}
export async function createVideo(v, memberIds = []) {
  const row = unwrap(await sb.from('videos').insert(clean(v)).select('id').single());
  await setVideoMembers(row.id, memberIds); return row;
}
export async function updateVideo(id, v, memberIds = []) {
  unwrap(await sb.from('videos').update(clean(v)).eq('id', id));
  await setVideoMembers(id, memberIds);
}
export async function deleteVideo(id) { unwrap(await sb.from('videos').delete().eq('id', id)); }

// ---------- Админка: значки ----------
const BADGE_COLS = 'id, slug, title, description, icon_url, emoji, created_at, sort_order';
export async function getBadges() { return unwrap(await sb.from('badges').select(BADGE_COLS).order('sort_order').order('id')); }
export async function createBadge(b) { return unwrap(await sb.from('badges').insert(clean(b)).select(BADGE_COLS).single()); }
export async function updateBadge(id, b) { return unwrap(await sb.from('badges').update(clean(b)).eq('id', id).select(BADGE_COLS).single()); }
export async function deleteBadge(id) { unwrap(await sb.from('badges').delete().eq('id', id)); }
export async function getMemberBadges() { return unwrap(await sb.from('member_badges').select('member_id, badge_id, awarded_at, note')); }
export async function awardBadge(memberId, badgeId, note, awardedAt) {
  unwrap(await sb.from('member_badges').upsert({ member_id: memberId, badge_id: badgeId, note: note?.trim() || null, awarded_at: awardedAt || null }));
}
export async function revokeBadge(memberId, badgeId) {
  unwrap(await sb.from('member_badges').delete().eq('member_id', memberId).eq('badge_id', badgeId));
}

// ---------- Новости ----------
const NEWS_COLS = 'id, title, body, image_url, source_url, source_name, published_at, pinned, status';
export async function getNews(limit, withDrafts = false) {
  let q = sb.from('news').select(withDrafts ? NEWS_COLS + ', preview_token' : NEWS_COLS);
  if (!withDrafts) q = q.eq('status', 'published');
  q = q.order('pinned', { ascending: false }).order('published_at', { ascending: false });
  if (limit) q = q.limit(limit);
  return unwrap(await q);
}
export async function getNewsItem(id, previewToken) {
  if (previewToken) {
    const rows = unwrap(await sb.rpc('news_preview', { p_id: +id, p_token: previewToken }));
    return rows?.[0] || null;
  }
  return unwrap(await sb.from('news').select(NEWS_COLS).eq('id', id).maybeSingle());
}
export async function createNews(n) { return unwrap(await sb.from('news').insert(clean(n)).select(NEWS_COLS).single()); }
export async function updateNews(id, n) { return unwrap(await sb.from('news').update(clean(n)).eq('id', id).select(NEWS_COLS).single()); }
export async function deleteNews(id) { unwrap(await sb.from('news').delete().eq('id', id)); }

// Картинка новости в Supabase Storage (бакет news, писать могут только админы)
export async function uploadNewsImage(blob, ext = 'webp') {
  const d = new Date();
  const path = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  unwrap(await sb.storage.from('news').upload(path, blob, { contentType: blob.type || 'image/webp', cacheControl: '31536000', upsert: false }));
  return sb.storage.from('news').getPublicUrl(path).data.publicUrl;
}

// ---------- Маскот ----------
export async function getMascotLines() {
  return unwrap(await sb.from('mascot_lines').select('text, kind, badge_id, member_id, page, badges(slug)').eq('active', true));
}
export async function getMascotProfile() {
  return unwrap(await sb.rpc('mascot_profile'));
}

// ---------- Календарь ----------
export async function getTodayEvents() { return unwrap(await sb.rpc('clan_events_on')); }
const EVENT_COLS = 'id, title, description, event_date, recurring_yearly, emoji';
export async function getClanEvents() { return unwrap(await sb.from('clan_events').select(EVENT_COLS).order('event_date')); }
export async function createClanEvent(e) { return unwrap(await sb.from('clan_events').insert(clean(e)).select(EVENT_COLS).single()); }
export async function updateClanEvent(id, e) { return unwrap(await sb.from('clan_events').update(clean(e)).eq('id', id).select(EVENT_COLS).single()); }
export async function deleteClanEvent(id) { unwrap(await sb.from('clan_events').delete().eq('id', id)); }
export async function getBirthdays() { return unwrap(await sb.from('member_private').select('member_id, birth_day, birth_month')); }
export async function setBirthday(memberId, day, month) {
  if (!day) unwrap(await sb.from('member_private').delete().eq('member_id', memberId));
  else unwrap(await sb.from('member_private').upsert({ member_id: memberId, birth_day: day, birth_month: month }));
}
