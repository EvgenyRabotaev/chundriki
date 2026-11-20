-- Комментарии под новостями: писать могут только участники клана (роль «Чундрики»).
create or replace function public.is_chundrik() returns boolean
language sql security definer stable set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.members m
    join auth.identities i on i.provider = 'discord' and i.provider_id = m.discord_id::text
    where i.user_id = auth.uid()
  );
$$;
grant execute on function public.is_chundrik() to anon, authenticated;

create table if not exists public.news_comments (
  id bigint generated always as identity primary key,
  news_id bigint not null references public.news(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text,
  author_avatar text,
  member_id bigint references public.members(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz default now()
);
create index if not exists news_comments_news_idx on public.news_comments (news_id, created_at);

create or replace function public.news_comments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_member record; v_ident record;
begin
  new.user_id := auth.uid();
  new.created_at := now();
  new.body := btrim(new.body);
  if exists (select 1 from public.news_comments where user_id = new.user_id and created_at > now() - interval '30 seconds') then
    raise exception 'Слишком часто';
  end if;
  if (select count(*) from public.news_comments where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Слишком много комментариев за сутки';
  end if;
  select identity_data, provider_id into v_ident from auth.identities where user_id = new.user_id and provider = 'discord' limit 1;
  select id, game_nick into v_member from public.members where discord_id::text = v_ident.provider_id limit 1;
  new.member_id := v_member.id;
  new.author_name := coalesce(nullif(v_member.game_nick, ''), v_ident.identity_data->>'full_name', v_ident.identity_data->>'name', 'Игрок');
  new.author_avatar := v_ident.identity_data->>'avatar_url';
  return new;
end $$;
drop trigger if exists news_comments_bi on public.news_comments;
create trigger news_comments_bi before insert on public.news_comments for each row execute function public.news_comments_before_insert();

alter table public.news_comments enable row level security;
drop policy if exists nc_select on public.news_comments;
drop policy if exists nc_insert on public.news_comments;
drop policy if exists nc_delete on public.news_comments;
create policy nc_select on public.news_comments for select to anon, authenticated using (true);
create policy nc_insert on public.news_comments for insert to authenticated with check (public.is_chundrik());
create policy nc_delete on public.news_comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());
grant select on public.news_comments to anon;
grant select, insert, delete on public.news_comments to authenticated;
