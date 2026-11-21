-- Видео клана живут внутри «Моментов»: расширяем videos, отдельные clan_videos убираем (в них данных не было).
drop table if exists public.clan_video_members;
drop table if exists public.clan_videos;
alter table public.videos add column if not exists tiktok_url text;
alter table public.videos add column if not exists is_short boolean not null default false;
create table if not exists public.video_members (
  video_id bigint not null references public.videos(id) on delete cascade,
  member_id bigint not null references public.members(id) on delete cascade,
  primary key (video_id, member_id)
);
alter table public.video_members enable row level security;
drop policy if exists video_members_read on public.video_members;
drop policy if exists video_members_admin on public.video_members;
create policy video_members_read on public.video_members for select to anon, authenticated using (true);
create policy video_members_admin on public.video_members for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.video_members to anon, authenticated;
grant insert, update, delete on public.video_members to authenticated;
