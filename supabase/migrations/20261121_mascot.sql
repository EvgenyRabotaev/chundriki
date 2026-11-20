-- Маскот-болтун: шутки + закрытые заметки об участниках. ЧЕРНОВИК, на боевую базу не применять без согласования.
create table if not exists public.mascot_lines (
  id bigint generated always as identity primary key,
  text text not null check (char_length(btrim(text)) between 1 and 400),
  kind text not null default 'general' check (kind in ('general','badge','member','page')),
  badge_id bigint references public.badges(id) on delete cascade,
  member_id bigint references public.members(id) on delete cascade,
  page text,                       -- index/news/moments/hall/roster/about
  active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists mascot_lines_kind_idx on public.mascot_lines (kind, active);
alter table public.mascot_lines enable row level security;
drop policy if exists ml_read on public.mascot_lines;
drop policy if exists ml_admin on public.mascot_lines;
create policy ml_read on public.mascot_lines for select to anon, authenticated using (active);
create policy ml_admin on public.mascot_lines for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Закрытые заметки об участниках (для будущих личных шуток). Видны только админам.
create table if not exists public.member_notes (
  id bigint generated always as identity primary key,
  member_id bigint not null references public.members(id) on delete cascade,
  note text not null,
  created_at timestamptz default now()
);
alter table public.member_notes enable row level security;
drop policy if exists mn_admin on public.member_notes;
create policy mn_admin on public.member_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Профиль для маскота: только про самого вошедшего пользователя. Заметки НЕ отдаём.
create or replace function public.mascot_profile() returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'member_id', m.id, 'nick', m.game_nick, 'joined_at', m.joined_at,
      'badges', coalesce((select jsonb_agg(b.slug) from public.member_badges mb join public.badges b on b.id = mb.badge_id where mb.member_id = m.id), '[]'::jsonb))
    from public.members m
    join auth.identities i on i.provider = 'discord' and i.provider_id = m.discord_id::text
    where i.user_id = auth.uid() limit 1), 'null'::jsonb);
$$;
grant execute on function public.mascot_profile() to authenticated;
