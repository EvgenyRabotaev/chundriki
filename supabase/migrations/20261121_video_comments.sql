-- Комментарии под видео («Моменты»): как у новостей, писать могут участники клана, удалять автор или админ.
create table if not exists public.video_comments (
  id bigint generated always as identity primary key,
  video_id bigint not null references public.videos(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text,
  author_avatar text,
  member_id bigint references public.members(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz default now()
);
create index if not exists video_comments_video_idx on public.video_comments (video_id, created_at);

create or replace function public.video_comments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_member record; v_ident record;
begin
  new.user_id := auth.uid();
  new.created_at := now();
  new.body := btrim(new.body);
  if exists (select 1 from public.video_comments where user_id = new.user_id and created_at > now() - interval '30 seconds') then
    raise exception 'Слишком часто';
  end if;
  if (select count(*) from public.video_comments where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Слишком много комментариев за сутки';
  end if;
  select identity_data, provider_id into v_ident from auth.identities where user_id = new.user_id and provider = 'discord' limit 1;
  select id, game_nick into v_member from public.members where discord_id::text = v_ident.provider_id limit 1;
  new.member_id := v_member.id;
  new.author_name := coalesce(nullif(v_member.game_nick, ''), v_ident.identity_data->>'full_name', v_ident.identity_data->>'name', 'Игрок');
  new.author_avatar := v_ident.identity_data->>'avatar_url';
  return new;
end $$;
drop trigger if exists video_comments_bi on public.video_comments;
create trigger video_comments_bi before insert on public.video_comments for each row execute function public.video_comments_before_insert();

alter table public.video_comments enable row level security;
drop policy if exists vc_select on public.video_comments;
drop policy if exists vc_insert on public.video_comments;
drop policy if exists vc_delete on public.video_comments;
create policy vc_select on public.video_comments for select to anon, authenticated using (true);
create policy vc_insert on public.video_comments for insert to authenticated with check (public.is_chundrik());
create policy vc_delete on public.video_comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());
grant select on public.video_comments to anon;
grant select, insert, delete on public.video_comments to authenticated;
