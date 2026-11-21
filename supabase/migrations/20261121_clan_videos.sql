-- Раздел «Видео»: ролики клана (YouTube / Shorts / TikTok) с отметкой участников.
-- Таблица videos уже занята старыми «Лучшими моментами», поэтому новая называется clan_videos.
create table if not exists public.clan_videos (
  id bigint generated always as identity primary key,
  youtube_id text,
  tiktok_url text,
  is_short boolean not null default false,
  title text not null,
  description text,
  published_at date not null default (now() at time zone 'Europe/Moscow')::date,
  created_at timestamptz not null default now(),
  sort_order integer not null default 0,
  constraint clan_videos_has_source check (youtube_id is not null or tiktok_url is not null)
);
create table if not exists public.clan_video_members (
  video_id bigint not null references public.clan_videos(id) on delete cascade,
  member_id bigint not null references public.members(id) on delete cascade,
  primary key (video_id, member_id)
);
alter table public.clan_videos enable row level security;
alter table public.clan_video_members enable row level security;
drop policy if exists clan_videos_read on public.clan_videos;
drop policy if exists clan_videos_admin on public.clan_videos;
drop policy if exists clan_video_members_read on public.clan_video_members;
drop policy if exists clan_video_members_admin on public.clan_video_members;
create policy clan_videos_read on public.clan_videos for select to anon, authenticated using (true);
create policy clan_videos_admin on public.clan_videos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy clan_video_members_read on public.clan_video_members for select to anon, authenticated using (true);
create policy clan_video_members_admin on public.clan_video_members for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.clan_videos, public.clan_video_members to anon, authenticated;
grant insert, update, delete on public.clan_videos, public.clan_video_members to authenticated;
