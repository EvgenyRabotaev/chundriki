-- Календарь событий клана: ручные события, дни рождения (приватно), годовщины вступления (авто).

create table if not exists public.clan_events (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  event_date date not null,
  recurring_yearly boolean not null default false,
  emoji text,
  created_at timestamptz not null default now()
);
alter table public.clan_events enable row level security;
drop policy if exists clan_events_read on public.clan_events;
drop policy if exists clan_events_admin on public.clan_events;
create policy clan_events_read on public.clan_events for select to anon, authenticated using (true);
create policy clan_events_admin on public.clan_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.clan_events to anon, authenticated;
grant insert, update, delete on public.clan_events to authenticated;

-- Дни рождения лежат в отдельной таблице: members читается всеми, а полная дата рождения не должна быть публичной.
create table if not exists public.member_birthdays (
  member_id bigint primary key references public.members(id) on delete cascade,
  birthday date not null
);
alter table public.member_birthdays enable row level security;
drop policy if exists member_birthdays_admin on public.member_birthdays;
create policy member_birthdays_admin on public.member_birthdays for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.member_birthdays from anon;
grant select, insert, update, delete on public.member_birthdays to authenticated;

-- События на дату (по умолчанию сегодня по Москве). Наружу уходят только день и месяц рождения, без года.
create or replace function public.clan_events_on(d date default null)
returns table(kind text, title text, description text, emoji text)
language sql stable security definer set search_path = public as $$
  with p as (select coalesce(d, (now() at time zone 'Europe/Moscow')::date) as day)
  select 'birthday'::text, 'День рождения: ' || m.game_nick, null::text, '🎂'
    from member_birthdays b join members m on m.id = b.member_id, p
   where extract(month from b.birthday) = extract(month from p.day) and extract(day from b.birthday) = extract(day from p.day)
  union all
  select 'anniversary', 
    case when y = 1 then 'Год в клане: ' || nick
         else y || case when y % 10 between 2 and 4 and y % 100 not between 12 and 14 then ' года' else ' лет' end || ' в клане: ' || nick end,
    null, '🎖'
    from (select m.game_nick as nick, (extract(year from p.day) - extract(year from m.joined_at))::int as y
            from members m, p
           where m.joined_at is not null
             and extract(month from m.joined_at) = extract(month from p.day) and extract(day from m.joined_at) = extract(day from p.day)) a
   where y >= 1
  union all
  select 'event', e.title, e.description, e.emoji
    from clan_events e, p
   where (e.recurring_yearly and extract(month from e.event_date) = extract(month from p.day) and extract(day from e.event_date) = extract(day from p.day))
      or (not e.recurring_yearly and e.event_date = p.day);
$$;
grant execute on function public.clan_events_on(date) to anon, authenticated;
